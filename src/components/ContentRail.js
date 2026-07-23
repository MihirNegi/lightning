import Blits from '@lightningjs/blits'
import { CARD_GAP, RAIL_VISIBLE_WIDTH, cardDimsFor } from '../constants/layout.js'
import { HOLD_THROTTLE_RAIL_MS, SETTLE_PX, easeStep } from '../helpers/animations.js'
import { getRailScrollOffset } from '../helpers/scroll.js'
import PosterCard from './PosterCard.js'

// Lazy-mount window: how many cards to render around the current selection.
// The visible clip runs to the screen edge (RAIL_VISIBLE_WIDTH), so portrait
// rails show ~6.5 cards and landscape ~3.8. AFTER covers everything to the
// right of focus (focus + AFTER cards must fill the clip so no gap appears
// at the right edge) plus a small forward buffer for a pressed key that
// arrives before scroll settles. BEFORE keeps a card mounted behind the
// focus for smooth back-scroll. Cards outside the window are unmounted and
// their image textures freed — keeps GPU fill rate low on TV hardware.
const WINDOW_BEFORE = 2
const WINDOW_AFTER = 7

// Card layout offsets inside the clip. Card sits 8px below the clip top and
// 12px inside the left edge; the focus frame is offset by (5, 5) less than
// the card so it surrounds the artwork with a 5px margin on every side.
const CARD_OFFSET_X = 12
const CARD_OFFSET_Y = 8
const FRAME_OFFSET_X = CARD_OFFSET_X - 5
const FRAME_OFFSET_Y = CARD_OFFSET_Y - 5

// Horizontally scrolling rail of poster cards. Owns real keyboard focus:
// Left/Right moves the selected card, and the previously selected card is
// remembered while the component instance is alive (via router keepAlive).
//
// Dimensions are orientation-driven: pass orientation="portrait" or
// "landscape" and the outer height, clip height, card size, and focus
// frame size all resolve from cardDimsFor(). This keeps the same component
// (and its scroll + focus logic) usable for both card shapes without
// forking a landscape variant.
//
// Scroll implementation: a manual requestAnimationFrame loop (see
// scrollTick + ensureScrollLoopRunning) moves scrollActual toward
// scrollTarget using exponential smoothing (easeStep). Input handlers
// update scrollTarget; the RAF loop picks up the new target on its next
// tick with velocity naturally proportional to remaining distance — so a
// press mid-motion just extends the target and the glide continues with
// no restart, no fresh duration budget, no velocity discontinuity. On
// release, the tail eases out on its own.
//
// The focus indicator is drawn HERE as a single static frame at slot
// (FRAME_OFFSET_X, FRAME_OFFSET_Y) inside the clipping window. The frame
// does NOT move — cards slide underneath the frame as the track scrolls
// left/right, and whichever card ends up in the focus slot appears framed.
export default Blits.Component('ContentRail', {
  components: {
    PosterCard,
  },
  template: `
    <Element :h="$outerH">
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
      <Element y="52" :w="$clipW" :h="$clipH" clipping="true">
        <Element :x="-$scrollActual">
          <PosterCard
            :for="(item, index) in $visibleItems"
            key="$item.id"
            :y="$cardOffsetY"
            :x="$item.posX"
            :title="$item.title"
            :genre="$item.genre"
            :image="$item.image"
            :progress="$item.progress"
            :cardW="$cardW"
            :cardH="$cardH"
          />
        </Element>
        <Element
          :x="$frameOffsetX"
          :y="$frameOffsetY"
          :w="$frameW"
          :h="$frameH"
          :alpha.transition="{value: $$hasFocus ? 1 : 0, duration: 200, easing: 'ease-out'}"
        >
          <Element x="0" y="0" :w="$frameW" h="5" color="#FFFFFF" />
          <Element x="0" :y="$frameBottomY" :w="$frameW" h="5" color="#FFFFFF" />
          <Element x="0" y="0" w="5" :h="$frameH" color="#FFFFFF" />
          <Element :x="$frameRightX" y="0" w="5" :h="$frameH" color="#FFFFFF" />
        </Element>
      </Element>
    </Element>
  `,
  props: {
    title: '',
    items: [],
    orientation: 'portrait',
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
      // Static offsets exposed as state so the template can bind them
      // without needing template-side computation.
      cardOffsetY: CARD_OFFSET_Y,
      frameOffsetX: FRAME_OFFSET_X,
      frameOffsetY: FRAME_OFFSET_Y,
    }
  },
  computed: {
    dims() {
      return cardDimsFor(this.orientation)
    },
    cardW() {
      return this.dims.cardW
    },
    cardH() {
      return this.dims.cardH
    },
    // Outer height: title area (52) + card + top padding above card (8)
    // + bottom padding below card (16). Matches the pattern used before
    // portrait was hardcoded (76 + 310 = 386).
    outerH() {
      return 76 + this.cardH
    },
    clipW() {
      return RAIL_VISIBLE_WIDTH
    },
    // Clip height: card + top offset (8) + a matching bottom breathing
    // room (16). Portrait resolves to 334, landscape to 284.
    clipH() {
      return this.cardH + 24
    },
    // Frame surrounds the card with a 5px margin on each side.
    frameW() {
      return this.cardW + 10
    },
    frameH() {
      return this.cardH + 10
    },
    // Bottom white bar of the focus frame sits at frameH - 5.
    frameBottomY() {
      return this.cardH + 5
    },
    frameRightX() {
      return this.cardW + 5
    },
    // Horizontal step per card slot: card width + inter-card gap.
    cardStep() {
      return this.cardW + CARD_GAP
    },
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
      this.scrollTarget = getRailScrollOffset(this.selectedIndex, this.cardW, CARD_GAP)
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
    // Per-frame step. Moves scrollActual toward scrollTarget with one call
    // to easeStep — exponential smoothing whose step size is a fraction of
    // the remaining distance, so velocity naturally decays as motion nears
    // the target. Reads target fresh each tick, so a new press mid-motion
    // just extends the target and the glide continues from wherever the
    // animation currently is. Stops once |remaining| < SETTLE_PX so idle
    // rails do not consume rAF slots chasing sub-pixel differences.
    scrollTick(now) {
      const dt = now - this.lastFrameTime
      this.lastFrameTime = now
      const remaining = this.scrollTarget - this.scrollActual
      if (Math.abs(remaining) < SETTLE_PX) {
        this.scrollActual = this.scrollTarget
        this.rafHandle = 0
        return
      }
      this.scrollActual = easeStep(this.scrollActual, this.scrollTarget, dt)
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
      const step = this.cardStep
      const slice = []
      for (let i = start; i < end; i++) {
        slice.push({ ...this.items[i], posX: CARD_OFFSET_X + i * step })
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
