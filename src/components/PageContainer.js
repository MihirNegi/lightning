import Blits from '@lightningjs/blits'
import { HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT } from '../constants/layout.js'
import { HOLD_THROTTLE_PAGE_MS } from '../helpers/animations.js'
import { getPageScrollOffset } from '../helpers/scroll.js'
import HeroCarousel from './HeroCarousel.js'
import ContentRail from './ContentRail.js'

// Grow-only lazy mount for rails: start with a small prefix mounted, and
// extend the mounted range as the user scrolls down. Rails stay mounted once
// visited so scroll-back is instant and image textures don't re-load. This
// gives the big win (small first-paint on initial load) without the ref /
// reindexing complexity of a sliding window.
const RAIL_INITIAL_MOUNT = 4
const RAIL_MOUNT_AHEAD = 3

// Time to slide one rail into position, in ms. Sets the vertical scroll
// cadence — held-key scroll produces one rail of motion per this interval.
// Matched exactly to HOLD_THROTTLE_PAGE_MS in helpers/animations.js so
// held-input feeds new targets to the RAF loop at exactly the rate it
// moves toward them, producing truly continuous motion during a held
// Down/Up press.
const TIME_PER_RAIL_MS = 260

// Pixel velocity implied by TIME_PER_RAIL_MS. The RAF scroll loop advances
// scrollActual toward scrollTarget by this * elapsed-ms every frame,
// producing constant-velocity motion regardless of when inputs actually
// arrive. This is why held-scroll feels smooth — the motion doesn't
// restart from zero velocity every time a new press changes the target,
// unlike a declarative transition. Mirrors the horizontal ContentRail
// pattern.
const SCROLL_VELOCITY_PX_PER_MS = RAIL_HEIGHT / TIME_PER_RAIL_MS

// Generic page layout: hero at the top, then a vertical stack of content rails.
// Handles Up/Down navigation between sections and remembers which section was
// last focused via component state (kept alive by the router's keepAlive flag).
// Rails are lazy-mounted grow-only (see visibleRails) so first paint is cheap.
//
// Scroll implementation: a manual requestAnimationFrame loop (see
// scrollTick + ensureScrollLoopRunning) moves scrollActual toward
// scrollTarget at constant velocity. Input handlers update scrollTarget;
// the RAF loop picks up the new target on its next tick without a velocity
// reset. This gives truly continuous motion during a held Down/Up — better
// than a Blits .transition, which restarts from the current position over
// a fixed duration each time the target changes and produces subtle
// velocity hitches at input-timing boundaries. Same pattern as ContentRail.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// x=64 matches CONTENT_PADDING_X; 880 matches HERO_HEIGHT; 410 = RAIL_HEIGHT.
export default Blits.Component('PageContainer', {
  components: {
    HeroCarousel,
    ContentRail,
  },
  template: `
    <Element :y="-$scrollActual">
      <HeroCarousel ref="hero" :slides="$hero" />
      <ContentRail
        :for="(rail, index) in $visibleRails"
        key="$rail.id"
        :ref="'rail' + $index"
        x="64"
        :y="880 + $index * 410"
        :title="$rail.title"
        :items="$rail.items"
      />
    </Element>
  `,
  props: {
    hero: [],
    rails: [],
  },
  state() {
    return {
      // 0 = hero, 1..N = rails
      sectionIndex: 0,
      // Contiguous prefix of rails currently mounted. Grows as the user scrolls
      // down (see ensureMounted). Must be a state field (not computed) because
      // Blits ':for' effects are scoped to the specific state key they read and
      // don't re-fire on computed changes.
      visibleRails: [],
      // Timestamp of the last accepted directional press, used for hold-throttling.
      lastInputAt: 0,
      // Where the page should be scrolled to, in px (positive = scrolled down).
      // Set by input handlers via updateScrollTarget; the RAF loop moves
      // scrollActual toward this at fixed velocity.
      scrollTarget: 0,
      // Where the page currently is. Updated ~60x/sec by scrollTick whenever
      // it differs from scrollTarget. Bound directly to the outer element's
      // y prop (negated), so every state change immediately repositions the
      // page.
      scrollActual: 0,
      // Active requestAnimationFrame id, or 0 if no loop is running.
      // Stored on the instance (not as reactive state) so we don't
      // trigger reactivity dispatch every time the loop starts/stops.
      // Assigned in ensureScrollLoopRunning and cleared in scrollTick
      // when the target is reached, or in the destroy hook on teardown.
      rafHandle: 0,
      // Timestamp of the last RAF tick, used to compute per-frame dt so
      // motion is proportional to real elapsed time (robust to frame
      // pacing jitter) rather than assumed to be 16.7ms per tick.
      lastFrameTime: 0,
    }
  },
  hooks: {
    init() {
      // Navbar emits this when the user presses Down/Enter to enter the page.
      this.$listen('nav:focus-content', () => this.focusCurrentSection())
      // Seed the initial visible prefix now that props are available.
      const initial = Math.min(RAIL_INITIAL_MOUNT, this.rails.length)
      this.visibleRails = this.rails.slice(0, initial)
    },
    // Cancel any in-flight RAF so we don't touch state on a component
    // that's already been torn down (which would throw on the next tick).
    destroy() {
      if (this.rafHandle) {
        cancelAnimationFrame(this.rafHandle)
        this.rafHandle = 0
      }
    },
  },
  input: {
    down() {
      if (!this.acceptHoldInput()) return
      if (this.sectionIndex >= this.rails.length) return
      this.sectionIndex++
      this.ensureMounted(this.sectionIndex - 1 + RAIL_MOUNT_AHEAD)
      this.focusCurrentSection()
      this.updateScrollTarget()
      this.ensureScrollLoopRunning()
    },
    up() {
      if (!this.acceptHoldInput()) return
      if (this.sectionIndex <= 0) {
        this.$emit('nav:focus-navbar')
        return
      }
      this.sectionIndex--
      this.focusCurrentSection()
      this.updateScrollTarget()
      this.ensureScrollLoopRunning()
    },
    back() {
      this.$emit('nav:focus-navbar')
    },
  },
  methods: {
    // Move focus to whichever section (hero or one of the rails) is now current.
    focusCurrentSection() {
      const ref = this.sectionIndex === 0 ? 'hero' : `rail${this.sectionIndex - 1}`
      const target = this.$select(ref)
      if (target) target.$focus()
    },
    // Update the scroll target based on the current section index. Does NOT
    // immediately move the page — the RAF loop advances scrollActual toward
    // scrollTarget over subsequent frames at constant velocity.
    updateScrollTarget() {
      this.scrollTarget = getPageScrollOffset(
        this.sectionIndex,
        HERO_HEIGHT,
        RAIL_HEIGHT,
        NAVBAR_HEIGHT,
      )
    },
    // Start the RAF scroll loop if it isn't already running. Called from
    // every accepted input. If the loop is already running, presses just
    // update scrollTarget and the loop picks up the new target on its
    // next tick — no restart, no velocity reset, no visible hitch at
    // the input boundary.
    ensureScrollLoopRunning() {
      if (this.rafHandle) return
      this.lastFrameTime = performance.now()
      this.rafHandle = requestAnimationFrame((now) => this.scrollTick(now))
    },
    // Per-frame step. Moves scrollActual toward scrollTarget by
    // SCROLL_VELOCITY_PX_PER_MS * elapsed-ms. Reads target and current
    // position fresh each tick, so new presses arriving during motion
    // just extend the target — constant-velocity motion continues
    // seamlessly. Stops (returns without rescheduling) once the target
    // is reached, so idle pages do not consume rAF slots.
    scrollTick(now) {
      const dt = now - this.lastFrameTime
      this.lastFrameTime = now
      const remaining = this.scrollTarget - this.scrollActual
      const step = SCROLL_VELOCITY_PX_PER_MS * dt
      if (Math.abs(remaining) <= step) {
        // Snap to target and stop the loop.
        this.scrollActual = this.scrollTarget
        this.rafHandle = 0
        return
      }
      this.scrollActual += Math.sign(remaining) * step
      this.rafHandle = requestAnimationFrame((next) => this.scrollTick(next))
    },
    // Grow the mounted range so that at least `throughIndex` (0-based rail
    // index) is included. Called on Down-scroll so the next few rails are
    // ready before the user can reach them. Never shrinks. Assigning a new
    // array reference is required for Blits' ':for' effect to re-fire —
    // mutating in place would not trigger the reactive setter.
    ensureMounted(throughIndex) {
      const needed = Math.min(throughIndex + 1, this.rails.length)
      if (needed > this.visibleRails.length) {
        this.visibleRails = this.rails.slice(0, needed)
      }
    },
    // Returns true if enough time has passed since the last accepted press.
    // Records the current time so the next call is throttled. Prevents key
    // auto-repeat from queuing dozens of section changes on a single hold.
    // Matched to TIME_PER_RAIL_MS via HOLD_THROTTLE_PAGE_MS so held-key input
    // produces exactly one accepted press per rail-time interval — feeding
    // the RAF loop targets at the same rate it moves.
    acceptHoldInput() {
      const now = Date.now()
      if (now - this.lastInputAt < HOLD_THROTTLE_PAGE_MS) return false
      this.lastInputAt = now
      return true
    },
  },
})
