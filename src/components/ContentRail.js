import Blits from '@lightningjs/blits'
import { CARD_GAP, CONTENT_PADDING_X, STAGE_W, cardDimsFor } from '../constants/layout.js'
import { HOLD_THROTTLE_RAIL_MS, SETTLE_PX, easeStep } from '../helpers/animations.js'
import PosterCard from './PosterCard.js'

// Lazy-mount window: how many cards to render around the current selection.
// The visible clip spans the full stage width. AFTER covers everything to
// the right of focus (focus + AFTER cards must fill the clip so no gap
// appears at the right edge) plus a small forward buffer for a pressed
// key that arrives before scroll settles. BEFORE keeps one card mounted
// behind the focus — that card is the "peek" tile that renders in the
// black area to the left of the title. Cards outside the window are
// unmounted and their image textures freed.
const WINDOW_BEFORE = 2
const WINDOW_AFTER = 7

// Static vertical offset of each card inside the clip. 8px of breathing
// room above the card, matched by a 16px pad in clipH below.
const CARD_OFFSET_Y = 8
// Frame-around-card margin: the focus frame sits 5px outside the card on
// every side. Exported so PageContainer's global frame overlay can size
// itself consistently with the rail's card layout.
export const FRAME_MARGIN = 5

// Horizontally scrolling rail of poster cards. Owns real keyboard focus:
// Left/Right moves the selected card, and the previously selected card is
// remembered while the component instance is alive (via router keepAlive).
//
// Dimensions are orientation-driven: pass orientation="portrait" or
// "landscape" and the outer height, clip height, card size, and focus
// frame size all resolve from cardDimsFor().
//
// Focus-slot model:
//   The focused card's left edge ALWAYS lands at absolute x = CONTENT_PADDING_X
//   (flush with the rail title). The clip is extended left of the title
//   into the 0..CONTENT_PADDING_X black band so the PREVIOUS card can
//   peek there — CONTENT_PADDING_X - CARD_GAP px of it are visible when
//   the user is not on card 0. On card 0 the black band is empty (there
//   is no card -1 to peek), which acts as the "start of rail" indicator.
//
// Because the focus slot is constant, the global focus frame in
// PageContainer never moves horizontally within a rail — the cards slide
// under it. That means this component does not need to notify the frame
// on Left/Right at all.
//
// Scroll implementation: a manual requestAnimationFrame loop (see
// scrollTick + ensureScrollLoopRunning) moves scrollActual toward
// scrollTarget using exponential smoothing (easeStep). Input handlers
// update scrollTarget; the RAF loop picks up the new target on its next
// tick with velocity proportional to remaining distance — so a press
// mid-motion just extends the target and the glide continues with no
// restart, no fresh duration budget, no velocity discontinuity.
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
      <Element :x="$clipX" y="52" :w="$clipW" :h="$clipH" clipping="true">
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
            :isScrolling="$isScrolling"
          />
        </Element>
      </Element>
    </Element>
  `,
  props: {
    title: '',
    items: [],
    orientation: 'portrait',
    // Forwarded from PageContainer. PosterCards read this to decide whether
    // to fade in and load their image src at mount, or wait for the parent
    // page's vertical scroll to settle first. This rail's own horizontal
    // scroll state does NOT feed into this prop — a card mounted during a
    // horizontal-only scroll behaves as if the page is at rest, which is
    // the correct behavior (horizontal is already smooth and doesn't need
    // the deferral).
    isScrolling: false,
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
      rafHandle: 0,
      // Timestamp of the last RAF tick, used to compute per-frame dt so
      // motion is proportional to real elapsed time (robust to frame
      // pacing jitter) rather than assumed to be 16.7ms per tick.
      lastFrameTime: 0,
      // Static offset for the card's y inside the clip.
      cardOffsetY: CARD_OFFSET_Y,
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
    // Clip rectangle covers the full stage width, positioned so its
    // absolute left edge is x=0. The rail element itself sits at
    // absolute x=CONTENT_PADDING_X (see PageContainer template), so the
    // clip's rail-local x must be -CONTENT_PADDING_X. Extending the clip
    // into the left padding band lets the previous card render there as
    // a peek tile once selectedIndex > 0.
    clipX() {
      return -CONTENT_PADDING_X
    },
    clipW() {
      return STAGE_W
    },
    // Clip height: card + top offset (8) + a matching bottom breathing
    // room (16). Portrait resolves to 334, landscape to 284.
    clipH() {
      return this.cardH + 24
    },
    // Horizontal step per card slot: card width + inter-card gap.
    cardStep() {
      return this.cardW + CARD_GAP
    },
  },
  hooks: {
    init() {
      // Prime the scroll so the focused card sits at the focus slot from
      // first paint — otherwise a freshly-mounted rail would sit at
      // scrollActual=0 while the global focus frame is pinned at
      // CONTENT_PADDING_X, and the frame would land between cards.
      this.updateScrollTarget()
      this.scrollActual = this.scrollTarget
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
    // Update the scroll target so the focused card's left edge lands at
    // absolute x = CONTENT_PADDING_X (aligned with the rail title). The
    // clip's absolute origin is x=0 (rail is at CONTENT_PADDING_X, clip is
    // offset -CONTENT_PADDING_X inside the rail), so card i's absolute x
    // simplifies to i * step - scrollActual. Solve for scrollActual with
    // i = selectedIndex landing at abs-x = CONTENT_PADDING_X:
    //   scrollActual = selectedIndex * step - CONTENT_PADDING_X
    // For card 0: scrollActual = -CONTENT_PADDING_X, so card 0 sits at
    // abs-x = 64 and the black band from 0..64 has no card to peek in.
    updateScrollTarget() {
      this.scrollTarget = this.selectedIndex * this.cardStep - CONTENT_PADDING_X
    },
    // Start the RAF scroll loop if it isn't already running. Called from
    // every accepted input. If the loop is already running, presses just
    // update scrollTarget and the loop picks up the new target on its
    // next tick — no restart, no velocity reset, no visible hitch.
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
        slice.push({ ...this.items[i], posX: i * step })
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
