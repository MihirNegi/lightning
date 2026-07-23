import Blits from '@lightningjs/blits'
import { CARD_W, CARD_GAP } from '../constants/layout.js'
import { HOLD_THROTTLE_RAIL_MS } from '../helpers/animations.js'
import { getRailScrollOffset } from '../helpers/scroll.js'
import PosterCard from './PosterCard.js'

// Lazy-mount window: how many cards to render around the current selection.
// ~7 cards fit in the visible clipping window, so BEFORE covers scroll-back
// and AFTER buffers forward scrolling. Cards outside the window are unmounted
// and their image textures freed — keeps GPU fill rate low on TV hardware.
// Tuned tight: BEFORE=2 (one card behind for smooth back-scroll), AFTER=5
// (visible cards + small forward buffer). Fewer mounted cards = fewer
// textured quads drawn per frame.
const WINDOW_BEFORE = 2
const WINDOW_AFTER = 5

// Horizontal step per card slot: card width + inter-card gap.
const CARD_STEP = CARD_W + CARD_GAP

// Time to slide one card into position, in ms. Sets the horizontal scroll
// cadence — held-key scroll produces one card of motion per this interval.
// 150ms feels responsive on a TV screen at viewing distance while being
// long enough that the eye can track the ribbon of cards flowing past.
const TIME_PER_CARD_MS = 150

// Pixel velocity implied by TIME_PER_CARD_MS. The RAF scroll loop advances
// scrollActual toward scrollTarget by this * elapsed-ms every frame,
// producing constant-velocity motion regardless of when inputs actually
// arrive. This is why the scroll feels smooth even under noisy key auto-
// repeat timing — the motion doesn't restart from zero velocity every
// time a new press changes the target, unlike a declarative transition.
const SCROLL_VELOCITY_PX_PER_MS = CARD_STEP / TIME_PER_CARD_MS

// Horizontally scrolling rail of poster cards. Owns real keyboard focus:
// Left/Right moves the selected card, and the previously selected card is
// remembered while the component instance is alive (via router keepAlive).
//
// Scroll implementation: a manual requestAnimationFrame loop (see
// scrollTick + ensureScrollLoopRunning) moves scrollActual toward
// scrollTarget at constant velocity. Input handlers update scrollTarget;
// the RAF loop picks up the new target on its next tick without a velocity
// reset. This gives truly continuous motion during a held scroll — better
// than a Blits .transition, which restarts from the current position over
// a fixed duration each time the target changes and produces subtle velocity
// hitches at input-timing boundaries.
//
// The focus indicator is drawn HERE as a single static frame at slot (7, 3)
// inside the clipping window (i.e. wrapping the leftmost-visible card). The
// frame does NOT move — cards slide underneath the frame as the track scrolls
// left/right, and whichever card ends up in the focus slot appears framed.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// Height 386 = RAIL_TITLE_HEIGHT (76) + CARD_H (310). Width 1792 = RAIL_VISIBLE_WIDTH.
// Inner content clip h=334 = outer 386 - title offset 52. 288 = CARD_W (260)
// + CARD_GAP (28). Frame is 270x310 (image 260x300 + 5px each side).
export default Blits.Component('ContentRail', {
  components: {
    PosterCard,
  },
  template: `
    <Element h="386">
      <Text
        :content="$title"
        size="32"
        color="#AAAAAA"
      />
      <Text
        :content="$title"
        size="32"
        color="#FFFFFF"
        :alpha.transition="{value: $$hasFocus ? 1 : 0, duration: 200, easing: 'ease-out'}"
      />
      <Element y="52" w="1792" h="334" clipping="true">
        <Element :x="-$scrollActual">
          <PosterCard
            :for="(item, index) in $visibleItems"
            key="$item.id"
            y="8"
            :x="$item.posX"
            :title="$item.title"
            :genre="$item.genre"
            :image="$item.image"
            :progress="$item.progress"
          />
        </Element>
        <Element
          x="7"
          y="3"
          w="270"
          h="310"
          :alpha.transition="{value: $$hasFocus ? 1 : 0, duration: 200, easing: 'ease-out'}"
        >
          <Element x="0" y="0" w="270" h="5" color="#FFFFFF" />
          <Element x="0" y="305" w="270" h="5" color="#FFFFFF" />
          <Element x="0" y="0" w="5" h="310" color="#FFFFFF" />
          <Element x="265" y="0" w="5" h="310" color="#FFFFFF" />
        </Element>
      </Element>
    </Element>
  `,
  props: {
    title: '',
    items: [],
  },
  state() {
    return {
      selectedIndex: 0,
      // Where the track should be, in px (positive = scrolled right).
      // Set by input handlers; the RAF loop moves scrollActual toward
      // this at fixed velocity.
      scrollTarget: 0,
      // Where the track currently is. Updated ~60x/sec by scrollTick
      // whenever it differs from scrollTarget. Bound directly to the
      // track element's x prop, so every state change immediately
      // repositions the track.
      scrollActual: 0,
      // Windowed slice of items currently mounted. Must be a state field
      // (not computed) because Blits ':for' effects are scoped to a
      // single state key and don't re-fire on computed changes — a
      // computed here would be evaluated once at mount and never update,
      // so scrolling past the initial window would show an empty rail.
      visibleItems: [],
      // Timestamp of the last accepted directional press, used for
      // hold-throttling.
      lastInputAt: 0,
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
      this.rebuildVisibleItems()
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
    left() {
      if (!this.acceptHoldInput()) return
      if (this.selectedIndex <= 0) return
      this.selectedIndex--
      this.updateScrollTarget()
      this.rebuildVisibleItems()
      this.ensureScrollLoopRunning()
    },
    right() {
      if (!this.acceptHoldInput()) return
      if (this.selectedIndex >= this.items.length - 1) return
      this.selectedIndex++
      this.updateScrollTarget()
      this.rebuildVisibleItems()
      this.ensureScrollLoopRunning()
    },
    enter() {
      const item = this.items[this.selectedIndex]
      if (!item) return
      // Rail items expose `genre` (Comedy, Drama, ...) but the Meta screen
      // reads a `subtitle` prop. Mapping here keeps Meta agnostic to where
      // the navigation came from — the hero carousel already ships a real
      // subtitle field, so both callers land on the same prop shape.
      this.$router.to('/meta', {
        title: item.title,
        subtitle: item.genre,
        description: item.description,
        image: item.image,
        video: item.video,
      })
    },
  },
  methods: {
    // Update the scroll target based on the current selected index. Does
    // NOT immediately move the track — the RAF loop advances scrollActual
    // toward scrollTarget over subsequent frames at constant velocity.
    updateScrollTarget() {
      this.scrollTarget = getRailScrollOffset(this.selectedIndex, CARD_W, CARD_GAP)
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
    // is reached, so idle rails do not consume rAF slots.
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
    // Rebuild the windowed visibleItems slice around the current
    // selection. Assigning a new array reference is required — mutating
    // in place would not trigger the reactive setter that drives the
    // ':for' effect. Each entry carries an absolute posX so the window
    // can slide without shifting any card's on-screen position.
    rebuildVisibleItems() {
      const start = Math.max(0, this.selectedIndex - WINDOW_BEFORE)
      const end = Math.min(this.items.length, this.selectedIndex + WINDOW_AFTER + 1)
      const slice = []
      for (let i = start; i < end; i++) {
        slice.push({ ...this.items[i], posX: 12 + i * CARD_STEP })
      }
      this.visibleItems = slice
    },
    // Returns true if enough time has passed since the last accepted
    // press. Records the current time so the next call is throttled.
    // Matched to TIME_PER_CARD_MS via HOLD_THROTTLE_RAIL_MS so held-key
    // input produces exactly one accepted press per card-time interval
    // — feeding the RAF loop targets at the same rate it moves.
    acceptHoldInput() {
      const now = Date.now()
      if (now - this.lastInputAt < HOLD_THROTTLE_RAIL_MS) return false
      this.lastInputAt = now
      return true
    },
  },
})
