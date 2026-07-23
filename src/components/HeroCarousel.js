import Blits from '@lightningjs/blits'
import { STAGE_W } from '../constants/layout.js'
import { DURATION, HOLD_THROTTLE_MS } from '../helpers/animations.js'
import HeroSlide from './HeroSlide.js'

// Autoplay tuned longer than the reference (was 5s). Long enough that the user
// can read the copy on a real TV; short enough to feel alive.
const AUTOPLAY_INTERVAL = 10000

// How much the Watch Now CTA shrinks when the user presses Enter, to give
// tactile feedback. Springs back to 1 after DURATION.fast.
const CTA_BOUNCE_SCALE = 0.94

// Full-width auto-playing hero banner. Owns keyboard focus while the user is
// on the hero section of a page: Left/Right manually change slides (and
// restart the autoplay timer), Enter triggers the Watch Now bounce.
//
// Transition model: every accepted navigation routes through goToSlide(index,
// dir) which records prevIndex + direction. slidesWithSlot then hands each
// child HeroSlide a target x and a duration:
//   - current slide  -> x=0, tween on (slides in from dir * STAGE_W)
//   - previous slide -> x=-dir * STAGE_W, tween on (slides out opposite way)
//   - all others     -> x=+dir * STAGE_W, duration 0 (snap to the waiting
//     side offscreen, so a future press finds them ready to slide in)
// This is why every navigation must call goToSlide even the autoplay tick
// and the enter case — direction must be tracked or the wrong slide side
// would jump across the stage.
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
      <HeroSlide
        :for="(slide, index) in $slidesWithSlot"
        key="$slide.id"
        :image="$slide.image"
        :title="$slide.title"
        :subtitle="$slide.subtitle"
        :description="$slide.description"
        :slotX="$slide.slotX"
        :slotDuration="$slide.slotDuration"
      />
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
      // Which slide is currently visible (0-based).
      currentIndex: 0,
      // The slide that was current before the in-flight transition began. Equal
      // to currentIndex when idle. Used by slidesWithSlot to keep the outgoing
      // panel animating out while the new one animates in.
      prevIndex: 0,
      // Direction of the last accepted transition. +1 = user went right (new
      // slide enters from the right; old exits to the left). -1 = went left.
      // Autoplay always uses +1. Ignored while prevIndex === currentIndex.
      direction: 1,
      // Scale applied to the Watch Now button — used for the press bounce.
      ctaScale: 1,
      // Interval id for the autoplay rotation, so we can cancel/restart it.
      autoplayId: null,
      // Timestamp of the last accepted directional press, used for hold-throttling.
      lastInputAt: 0,
    }
  },
  hooks: {
    // Start rotating slides only while the hero actually has focus. Rotating
    // in the background costs frame budget (the slide transition is the biggest
    // per-tick expense of this page) with no user benefit — nobody sees the
    // change when they're scrolled to a rail or on a different tab.
    // Also guarded on slides — heroless pages always mount HeroCarousel
    // (to keep its ref reachable via $select), so focus() can fire on an
    // empty instance; no slides means no autoplay work to do.
    focus() {
      if (!this.slides.length) return
      this.startAutoplay()
    },
    unfocus() {
      this.stopAutoplay()
    },
    destroy() {
      this.stopAutoplay()
    },
  },
  computed: {
    // Per-slide target position + transition duration. Recomputes when
    // currentIndex, prevIndex, or direction change; Blits reactively pushes
    // the new slotX/slotDuration into each mounted HeroSlide, and the child's
    // :x.transition binding tweens.
    //
    // Non-current, non-prev slides get duration 0 so they snap to the current
    // waiting position (direction * STAGE_W) — without this, changing direction
    // between presses would sweep resting slides across the visible stage.
    slidesWithSlot() {
      const inFlight = this.prevIndex !== this.currentIndex
      return this.slides.map((slide, i) => {
        if (i === this.currentIndex) {
          return { ...slide, slotX: 0, slotDuration: DURATION.hero }
        }
        if (inFlight && i === this.prevIndex) {
          return {
            ...slide,
            slotX: -this.direction * STAGE_W,
            slotDuration: DURATION.hero,
          }
        }
        return {
          ...slide,
          slotX: this.direction * STAGE_W,
          slotDuration: 0,
        }
      })
    },
  },
  input: {
    // Show the previous slide and restart autoplay so the user gets the full
    // dwell time on the manually-chosen slide.
    left() {
      if (!this.acceptHoldInput()) return
      if (!this.slides.length) return
      const previous = this.currentIndex === 0 ? this.slides.length - 1 : this.currentIndex - 1
      this.goToSlide(previous, -1)
    },
    // Show the next slide and restart autoplay.
    right() {
      if (!this.acceptHoldInput()) return
      if (!this.slides.length) return
      const next = this.currentIndex === this.slides.length - 1 ? 0 : this.currentIndex + 1
      this.goToSlide(next, 1)
    },
    // Watch Now bounce feedback, then navigate to the Meta screen for the
    // currently visible slide. Bounce fires immediately; the routing happens
    // on the same tick, so the user sees the scale-down begin as the
    // transition starts (feels connected rather than laggy).
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
    // Jump to a specific slide index with a given direction (+1 = came from
    // the left / entered from the right, -1 = the reverse). Resets the
    // autoplay dwell timer so a manually-chosen slide gets the full interval
    // before rotating away.
    goToSlide(index, direction) {
      this.prevIndex = this.currentIndex
      this.currentIndex = index
      this.direction = direction
      this.startAutoplay()
    },
    // (Re)start the autoplay interval. Called when the hero gains focus and
    // whenever the user manually changes slides (to reset the dwell timer).
    // Autoplay always advances forward, so passes +1 as direction.
    startAutoplay() {
      if (this.autoplayId) this.$clearInterval(this.autoplayId)
      this.autoplayId = this.$setInterval(() => {
        const next = this.currentIndex === this.slides.length - 1 ? 0 : this.currentIndex + 1
        this.goToSlide(next, 1)
      }, AUTOPLAY_INTERVAL)
    },
    // Cancel the autoplay interval. Called when the hero loses focus (user
    // scrolled to a rail or switched tabs) so we stop doing per-slide work
    // that nobody can see.
    stopAutoplay() {
      if (this.autoplayId) {
        this.$clearInterval(this.autoplayId)
        this.autoplayId = null
      }
    },
    // Returns true if enough time has passed since the last accepted press.
    // Records the current time so the next call is throttled. Prevents key
    // auto-repeat from flipping slides faster than the slide transition can play.
    acceptHoldInput() {
      const now = Date.now()
      if (now - this.lastInputAt < HOLD_THROTTLE_MS) return false
      this.lastInputAt = now
      return true
    },
  },
})
