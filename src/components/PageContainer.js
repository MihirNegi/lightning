import Blits from '@lightningjs/blits'
import { HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT } from '../constants/layout.js'
import { HOLD_THROTTLE_PAGE_MS } from '../helpers/animations.js'
import { getPageScrollOffset } from '../helpers/scroll.js'
import HeroCarousel from './HeroCarousel.js'
import ContentRail from './ContentRail.js'

// Peak scroll velocity in px/ms. Caps how fast scrollActual can advance
// per frame so held-key scrolling cruises at exactly one rail per
// HOLD_THROTTLE_PAGE_MS — matching the input cadence and the previous
// constant-velocity model. Without this cap, exponential smoothing alone
// would fire scrollActual toward the target at a peak velocity roughly
// 2x the desired cruise speed (because the eased step is proportional to
// remaining distance), which reads as the first half of the slide being
// too fast.
const MAX_SCROLL_VELOCITY_PX_PER_MS = RAIL_HEIGHT / HOLD_THROTTLE_PAGE_MS

// Exponential smoothing half-life in ms. Only takes over from the velocity
// cap once the eased step becomes smaller than the cap — i.e. near the
// target. Controls how the tail of the motion eases out after the user
// releases: shorter = snappier arrival, longer = softer landing. 60ms
// gives a clear ease-out without feeling floaty.
const SCROLL_HALF_LIFE_MS = 60

// Distance (px) below which scrollActual snaps to scrollTarget and the
// RAF loop halts. Exponential smoothing asymptotes toward the target, so
// without a snap threshold the loop would spin forever moving sub-pixel
// amounts.
const SCROLL_SNAP_EPSILON_PX = 0.5

// Generic page layout: hero at the top, then a vertical stack of content rails.
// Handles Up/Down navigation between sections and remembers which section was
// last focused via component state (kept alive by the router's keepAlive flag).
// All rails are mounted eagerly on init — the earlier grow-only lazy mount
// pattern was removed because mounting a rail during a scroll press caused
// a frame-budget spike (new scene-graph nodes + first-draw textures) that
// was visible as a hitch on the vertical tween. Mounting up front costs a
// slower first paint but removes that spike from every subsequent scroll.
//
// Scroll implementation: a manual requestAnimationFrame loop (see
// scrollTick + ensureScrollLoopRunning) advances scrollActual toward
// scrollTarget using a hybrid of a velocity cap and exponential smoothing.
// Far from the target the velocity cap dominates, producing linear cruise
// at the same speed as the previous constant-velocity model — so held
// Down/Up feels consistent and no faster than before. Near the target the
// exponential ease dominates, producing a soft landing rather than a
// snap. Input handlers update scrollTarget; the RAF loop reads the
// current target each tick, so a new press mid-motion just extends the
// target — no restart, no velocity reset. Better than a Blits
// .transition, which restarts from the current position over a fixed
// duration each time the target changes and produces subtle velocity
// hitches at input-timing boundaries.
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
      // All rails, mounted eagerly on init. Must be a state field (not
      // computed off `rails`) because Blits ':for' effects are scoped to the
      // specific state key they read and don't re-fire on computed changes —
      // and because the array reference must be set post-props-available in
      // init(), not at state() construction time when props aren't wired yet.
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
      // Mount every rail up front so scroll never triggers new mounts (which
      // otherwise steal frame budget from the vertical scroll tween). Slice
      // to a new array reference so Blits' ':for' reactivity picks it up.
      this.visibleRails = this.rails.slice()
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
    // Per-frame step. Computes two candidate step sizes and takes the
    // smaller: an exponential ease (half the gap closes every
    // SCROLL_HALF_LIFE_MS) and a velocity cap (MAX_SCROLL_VELOCITY_PX_PER_MS
    // * elapsed-ms). Far from the target the cap wins, giving linear
    // cruise at the desired input cadence; near the target the ease wins,
    // giving a soft landing. Both branches are frame-rate independent.
    // Reads target and current position fresh each tick, so new presses
    // arriving during motion just extend the target — motion continues
    // seamlessly with no velocity reset. Snaps and stops the loop once
    // the remaining gap falls below the snap epsilon, so idle pages do
    // not consume RAF slots on the asymptotic tail.
    scrollTick(now) {
      const dt = now - this.lastFrameTime
      this.lastFrameTime = now
      const remaining = this.scrollTarget - this.scrollActual
      if (Math.abs(remaining) <= SCROLL_SNAP_EPSILON_PX) {
        this.scrollActual = this.scrollTarget
        this.rafHandle = 0
        return
      }
      const easedStep = remaining * (1 - Math.pow(0.5, dt / SCROLL_HALF_LIFE_MS))
      const maxStep = MAX_SCROLL_VELOCITY_PX_PER_MS * dt
      const step = Math.abs(easedStep) > maxStep ? Math.sign(easedStep) * maxStep : easedStep
      this.scrollActual += step
      this.rafHandle = requestAnimationFrame((next) => this.scrollTick(next))
    },
    // Returns true if enough time has passed since the last accepted press.
    // Records the current time so the next call is throttled. Prevents key
    // auto-repeat from queuing dozens of section changes on a single hold.
    // HOLD_THROTTLE_PAGE_MS sets the desired cadence for held-key scrolling
    // (one rail advanced per this interval); the exponential smoothing in
    // scrollTick handles the actual motion between each accepted target.
    acceptHoldInput() {
      const now = Date.now()
      if (now - this.lastInputAt < HOLD_THROTTLE_PAGE_MS) return false
      this.lastInputAt = now
      return true
    },
  },
})
