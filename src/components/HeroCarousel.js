import Blits from '@lightningjs/blits'
import { STAGE_W } from '../constants/layout.js'
import {
  DURATION,
  HOLD_THROTTLE_MS,
  RAIL_SCROLL_TAU_MS,
  SETTLE_PX,
  easeStep,
} from '../helpers/animations.js'
import HeroSlide from './HeroSlide.js'

// Autoplay tuned longer than the reference (was 5s). Long enough that the user
// can read the copy on a real TV; short enough to feel alive.
const AUTOPLAY_INTERVAL = 10000

// How much the Watch Now CTA shrinks when the user presses Enter, to give
// tactile feedback. Springs back to 1 after DURATION.fast.
const CTA_BOUNCE_SCALE = 0.94

// Full-width auto-playing hero banner. Owns keyboard focus while the user is
// on the hero section of a page: Left/Right scrolls the strip one slide,
// Enter triggers the Watch Now bounce and routes to Meta.
//
// Scroll model (mirrors ContentRail / PageContainer):
//   All N slides are laid out side-by-side in a strip at positions
//   0, STAGE_W, 2*STAGE_W, ..., (N-1)*STAGE_W. A wrapping clone of slide 0
//   is added at N*STAGE_W and a clone of slide N-1 at -STAGE_W so the
//   strip is visually continuous across the wrap boundary in both
//   directions. scrollActual is the strip's current x offset; scrollTarget
//   is where it wants to be. A rAF loop moves scrollActual toward
//   scrollTarget with easeStep (velocity proportional to remaining
//   distance), so a chained press mid-motion just extends the target and
//   the glide continues from wherever the strip currently is — no restart,
//   no fresh duration budget, no two-cards-crossing artifact.
//
// Wrap invariant:
//   Right press from slide N-1: scrollTarget advances past the base range
//   to N*STAGE_W (the clone of slide 0). Once the ease settles we
//   normalize: subtract N*STAGE_W from both scrollActual and scrollTarget.
//   The subtraction is invisible because slide 0 (base at 0) and slide 0
//   (clone at N*STAGE_W) render identically. Left press from slide 0
//   mirrors: targets -STAGE_W, then adds N*STAGE_W on settle.
//
// Chained press across the wrap:
//   If a new press arrives before the normalize snap has run, we apply the
//   pending snap first (invisibly, per above), then compute the new target
//   relative to the already-normalized positions. This lets the ease
//   continue smoothly across arbitrarily many chained wraps without ever
//   needing more than one clone on each side.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// 1920x880 matches STAGE_W and HERO_HEIGHT. x=64 matches CONTENT_PADDING_X.
// Watch Now sits at y=760 above the pagination dots at y=850.
export default Blits.Component('HeroCarousel', {
  components: {
    HeroSlide,
  },
  template: `
    <Element w="1920" h="880">
      <Element w="1920" h="880" clipping="true">
        <Element :x="$stripX">
          <HeroSlide
            :for="(entry, index) in $slideEntries"
            key="$entry.key"
            :x="$entry.x"
            :image="$entry.image"
            :title="$entry.title"
            :subtitle="$entry.subtitle"
            :description="$entry.description"
          />
        </Element>
      </Element>
      <Element
        x="64"
        y="760"
        w="220"
        h="60"
        :rounded="8"
        :color="$$hasFocus ? '#00B3FF' : 'rgba(255, 255, 255, 0.15)'"
        :border="{width: 2, color: '#FFFFFF'}"
        :scale.transition="{value: $ctaScale, duration: 200}"
      >
        <Text content="Watch Now" size="24" color="#FFFFFF" x="30" y="14" />
      </Element>
      <Element x="64" y="850">
        <Element
          :for="(slide, index) in $slides"
          key="$slide.id"
          :x="$index * 22"
          w="12"
          h="12"
          :rounded="6"
          :color="$index === $currentIndex ? '#00B3FF' : 'rgba(255, 255, 255, 0.35)'"
        />
      </Element>
    </Element>
  `,
  props: {
    slides: [],
  },
  state() {
    return {
      // Which slide is logically current (0-based). Drives the pagination
      // dot and the Enter routing target. Updates immediately on press —
      // the ease loop then glides scrollActual toward the matching pixel
      // position.
      currentIndex: 0,
      // Where the strip currently sits, in stage px. Bound to the strip
      // element's x via stripX (negated). Updated ~60x/sec by scrollTick
      // whenever it differs from scrollTarget.
      scrollActual: 0,
      // Where the strip should sit. Set by input handlers and autoplay.
      // The rAF loop reads this fresh each tick, so mid-motion presses
      // just extend the target without restarting anything.
      scrollTarget: 0,
      // Deferred normalization set by a wrap-inducing press. Non-zero
      // while scrollActual is heading toward a clone position; applied
      // invisibly on ease settle or on the next chained press. The clone
      // renders identically to its base sibling, so the subtraction of
      // N*STAGE_W from scrollActual + scrollTarget produces no visual
      // change on screen.
      pendingSnap: 0,
      // Rendered strip entries — one per base slide plus two clones for
      // the wrap. Built once at init and only rebuilt if the slides prop
      // reference changes (see slidesWatcher-equivalent below). Must be
      // state, not computed: Blits ':for' effects re-fire on state array
      // changes but not on computed reads.
      slideEntries: [],
      // Scale applied to the Watch Now button — used for the press bounce.
      ctaScale: 1,
      // Interval id for the autoplay rotation, so we can cancel/restart it.
      autoplayId: null,
      // Timestamp of the last accepted directional press, used for
      // hold-throttling. Keeps auto-repeat from queuing dozens of slide
      // steps that outrun the ease loop.
      lastInputAt: 0,
      // Active requestAnimationFrame id, or 0 if no loop is running.
      // Kept on the instance (not reactive state) so start/stop doesn't
      // dispatch reactivity.
      rafHandle: 0,
      // Timestamp of the last rAF tick for computing per-frame dt so ease
      // velocity is proportional to real elapsed time.
      lastFrameTime: 0,
    }
  },
  computed: {
    // Strip element's x = -scrollActual so a positive scrollActual moves
    // the strip left (revealing the next slide on the right).
    stripX() {
      return -this.scrollActual
    },
  },
  hooks: {
    // Build the strip once — slides are a fixed prop for the page, so
    // the entries never need to rebuild after init. Cannot be done in
    // state() because state() runs before props are populated —
    // this.slides would be [] at that point.
    init() {
      this.rebuildSlideEntries()
    },
    // Start rotating slides only while the hero actually has focus. Same
    // rationale as before: rotating in the background costs frame budget
    // (the ease loop is the biggest per-tick expense of this page) with
    // no user benefit. Guarded on slides so heroless pages that still
    // mount an empty HeroCarousel don't schedule an interval that would
    // no-op forever.
    focus() {
      if (!this.slides.length) return
      this.startAutoplay()
    },
    unfocus() {
      this.stopAutoplay()
      this.stopScrollLoop()
    },
    destroy() {
      this.stopAutoplay()
      this.stopScrollLoop()
    },
  },
  input: {
    // Scroll to the previous slide and restart the autoplay dwell timer
    // so the user gets the full interval on a manually-chosen slide.
    left() {
      if (!this.acceptHoldInput()) return
      if (!this.slides.length) return
      this.navigate(-1)
    },
    // Scroll to the next slide and restart the autoplay dwell timer.
    right() {
      if (!this.acceptHoldInput()) return
      if (!this.slides.length) return
      this.navigate(1)
    },
    // Watch Now bounce feedback, then navigate to the Meta screen for the
    // currently visible slide. Bounce fires immediately; the routing
    // happens on the same tick so the user sees the scale-down begin as
    // the transition starts (feels connected rather than laggy).
    enter() {
      this.ctaScale = CTA_BOUNCE_SCALE
      this.$setTimeout(() => {
        this.ctaScale = 1
      }, DURATION.fast)
      const slide = this.slides[this.currentIndex]
      if (!slide) return
      this.$router.to('/meta', {
        title: slide.title,
        subtitle: slide.subtitle,
        description: slide.description,
        image: slide.image,
        video: slide.video,
      })
    },
  },
  methods: {
    // Move to the neighbour slide in `direction` (+1 = right, -1 = left).
    // Chained presses across the wrap resolve the previous wrap's pending
    // snap first (invisibly, since we're always near or past the clone
    // that renders identically to the base slide) so the new target can
    // be computed relative to the base coordinate range.
    navigate(direction) {
      this.applyPendingSnap()
      const N = this.slides.length
      const nextIndex = (this.currentIndex + direction + N) % N
      const isWrap =
        (direction === 1 && this.currentIndex === N - 1) ||
        (direction === -1 && this.currentIndex === 0)
      if (isWrap) {
        // Target the clone position (one step past the base range in the
        // travel direction). Once the ease settles, applyPendingSnap
        // subtracts N*STAGE_W to bring both positions back into the base
        // range — invisible because the clone is a pixel-identical render
        // of the wrap-target base slide.
        this.scrollTarget += direction * STAGE_W
        this.pendingSnap = -direction * N * STAGE_W
      } else {
        this.scrollTarget = nextIndex * STAGE_W
      }
      this.currentIndex = nextIndex
      this.startAutoplay()
      this.ensureScrollLoopRunning()
    },
    // Invisibly normalize scrollActual + scrollTarget so both sit inside
    // the base coordinate range [0, (N-1)*STAGE_W]. Called on ease settle
    // and on any chained press that arrives before settle. Safe to call
    // when pendingSnap is 0 — it's a no-op then.
    applyPendingSnap() {
      if (this.pendingSnap === 0) return
      this.scrollActual += this.pendingSnap
      this.scrollTarget += this.pendingSnap
      this.pendingSnap = 0
    },
    // Build the filmstrip once. N base entries at positions 0..N-1 plus
    // two clones (slide 0 at N*STAGE_W, slide N-1 at -STAGE_W) so the
    // strip is continuous across the wrap boundary in either direction.
    // Skipping the clones when N <= 1 avoids a duplicate key collision on
    // the degenerate single-slide case.
    rebuildSlideEntries() {
      const N = this.slides.length
      if (N === 0) {
        this.slideEntries = []
        return
      }
      const entries = this.slides.map((slide, i) => ({
        ...slide,
        key: `slide-${i}`,
        x: i * STAGE_W,
      }))
      if (N > 1) {
        entries.push({
          ...this.slides[0],
          key: 'slide-first-clone',
          x: N * STAGE_W,
        })
        entries.push({
          ...this.slides[N - 1],
          key: 'slide-last-clone',
          x: -STAGE_W,
        })
      }
      this.slideEntries = entries
    },
    // Start the rAF scroll loop if it isn't already running. Called from
    // every accepted input. If the loop is already running, presses just
    // update scrollTarget and the loop picks up the new target on its
    // next tick — no restart, no velocity reset, no visible hitch.
    ensureScrollLoopRunning() {
      if (this.rafHandle) return
      this.lastFrameTime = performance.now()
      this.rafHandle = requestAnimationFrame((now) => this.scrollTick(now))
    },
    // Per-frame step. Moves scrollActual toward scrollTarget with one call
    // to easeStep — exponential smoothing whose step size is a fraction
    // of the remaining distance, so velocity naturally decays as motion
    // nears the target. On settle we resolve any pending wrap snap so the
    // strip returns to the base coordinate range before the next press.
    scrollTick(now) {
      const dt = now - this.lastFrameTime
      this.lastFrameTime = now
      const remaining = this.scrollTarget - this.scrollActual
      if (Math.abs(remaining) < SETTLE_PX) {
        this.scrollActual = this.scrollTarget
        this.applyPendingSnap()
        this.rafHandle = 0
        return
      }
      this.scrollActual = easeStep(this.scrollActual, this.scrollTarget, dt, RAIL_SCROLL_TAU_MS)
      this.rafHandle = requestAnimationFrame((next) => this.scrollTick(next))
    },
    // Cancel any in-flight rAF so we don't touch state on a component
    // that's already been torn down (which would throw on the next tick).
    stopScrollLoop() {
      if (this.rafHandle) {
        cancelAnimationFrame(this.rafHandle)
        this.rafHandle = 0
      }
    },
    // (Re)start the autoplay interval. Called when the hero gains focus
    // and whenever the user manually changes slides (to reset the dwell
    // timer). Autoplay always advances forward.
    startAutoplay() {
      if (this.autoplayId) this.$clearInterval(this.autoplayId)
      this.autoplayId = this.$setInterval(() => {
        this.navigate(1)
      }, AUTOPLAY_INTERVAL)
    },
    // Cancel the autoplay interval. Called when the hero loses focus
    // (user scrolled to a rail or switched tabs) so we stop doing
    // per-slide work that nobody can see.
    stopAutoplay() {
      if (this.autoplayId) {
        this.$clearInterval(this.autoplayId)
        this.autoplayId = null
      }
    },
    // Returns true if enough time has passed since the last accepted
    // press. Prevents key auto-repeat (~30/sec) from queuing many slide
    // steps that would send the ease loop chasing a distant target
    // faster than the eye can register the intermediate slides.
    acceptHoldInput() {
      const now = Date.now()
      if (now - this.lastInputAt < HOLD_THROTTLE_MS) return false
      this.lastInputAt = now
      return true
    },
  },
})
