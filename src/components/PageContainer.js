import Blits from '@lightningjs/blits'
import {
  CARD_GAP,
  CONTENT_PADDING_X,
  HERO_HEIGHT,
  NAVBAR_HEIGHT,
  NAVBAR_TOP_GAP,
  cardDimsFor,
} from '../constants/layout.js'
import { PAGE_SCROLL_TAU_MS, SETTLE_PX, easeStep } from '../helpers/animations.js'
import HeroCarousel from './HeroCarousel.js'
import ContentRail, { CARD_OFFSET_X, FRAME_MARGIN, PEEK_LEFT_FRACTION } from './ContentRail.js'

// Rail's inner title strip height. ContentRail places its clip at y=52
// below the rail's origin; the frame overlay lines up with the card
// inside the clip using this + the card's own inner offset.
const RAIL_TITLE_STRIP_H = 52
// The clip's inner top padding above the card (from ContentRail's
// CARD_OFFSET_Y). Duplicated as a literal here so the overlay does not
// need to import a private constant; kept in sync manually if tuned.
const CARD_INNER_TOP_Y = 8

// Rail virtualization window: how many rails to keep mounted around the
// focused section. Blits' :range directive uses [from, to) semantics
// (exclusive end), so the total mounted is UP + VISIBLE + DOWN. Rails
// outside this window are unmounted — their ContentRail instances are
// destroyed, freeing all their card image textures.
const RAIL_BUFFER_UP = 1
const RAIL_BUFFER_DOWN = 1
const RAIL_VISIBLE_ROWS = 3

// Where the first content row lands on screen — matches the offset the
// vertical scroll produces when snapping any rail into place. Kept in one
// place so hero and heroless pages agree on it.
const CONTENT_TOP_Y = NAVBAR_HEIGHT + NAVBAR_TOP_GAP

// Generic page layout. Two modes:
//   - With hero: an 880px HeroCarousel at the top, then a vertical stack
//     of rails starting at HERO_HEIGHT. sectionIndex 0 focuses the hero,
//     1..N focus each rail.
//   - Without hero (hero prop empty): rails start at CONTENT_TOP_Y so the
//     first rail already sits just below the navbar with no scroll
//     required. sectionIndex 0..N-1 focus each rail directly.
//
// Rails can have per-rail heights (portrait vs landscape orientation),
// so vertical positions are cumulative sums of individual rail heights
// rather than a fixed step. railsWithLayout computes both the per-rail
// Y (for template positioning) and the target scroll Y (for focusing
// that rail) in a single pass.
//
// Rail mounting: only ~5 rails (RAIL_VISIBLE_ROWS + buffers) are mounted
// at any time via Blits' :range directive. As the user scrolls Down/Up
// we slide the window with updateRailWindow(), which must run BEFORE
// focus moves so the target rail is guaranteed mounted when $select()
// looks for it.
//
// Scroll motion: a manual requestAnimationFrame loop (scrollTick +
// ensureScrollLoopRunning) eases animY toward the target Y using
// exponential smoothing (easeStep). A new Up/Down press mid-motion just
// updates sectionIndex, and the next tick continues gliding from the
// current visual position toward the new target.
export default Blits.Component('PageContainer', {
  components: {
    HeroCarousel,
    ContentRail,
  },
  template: `
    <Element>
      <Element :y="$animY">
        <HeroCarousel ref="hero" :show="$hasHero" :slides="$hero" />
        <ContentRail
          :for="(rail, index) in $railsWithLayout"
          :range="{from: $railWinStart, to: $railWinEnd}"
          key="$rail.id"
          :ref="'rail' + $index"
          x="64"
          :y="$rail._y"
          :title="$rail.title"
          :items="$rail.items"
          :orientation="$rail.orientation"
        />
      </Element>
      <Element
        :x.transition="{value: $frameX, duration: 200, easing: 'ease-out'}"
        :y="$frameY"
        :w.transition="{value: $frameW, duration: 200, easing: 'ease-out'}"
        :h.transition="{value: $frameH, duration: 200, easing: 'ease-out'}"
        :alpha.transition="{value: $isRailFocused ? 1 : 0, duration: 200, easing: 'ease-out'}"
      >
        <Element x="0" y="0" :w="$frameW" :h="$frameMargin" color="#FFFFFF" />
        <Element x="0" :y="$frameBottomBarY" :w="$frameW" :h="$frameMargin" color="#FFFFFF" />
        <Element x="0" y="0" :w="$frameMargin" :h="$frameH" color="#FFFFFF" />
        <Element :x="$frameRightBarX" y="0" :w="$frameMargin" :h="$frameH" color="#FFFFFF" />
      </Element>
    </Element>
  `,
  props: {
    hero: [],
    rails: [],
  },
  state() {
    return {
      // 0 = hero (if present), 1..N = rails. When there is no hero,
      // 0..N-1 map directly to rails.
      sectionIndex: 0,
      // Index of the first rail mounted by the :range virtualization window.
      railWinStart: 0,
      // Index one past the last rail mounted by the :range window.
      railWinEnd: RAIL_VISIBLE_ROWS + RAIL_BUFFER_DOWN,
      // Current animated Y for the outer container. Bound directly to the
      // template — every scrollTick assignment repositions the whole stack.
      animY: 0,
      // Active requestAnimationFrame id, or 0 if no loop is running.
      rafHandle: 0,
      // Timestamp of the last rAF tick, used to compute per-frame dt so
      // easeStep is proportional to real elapsed time.
      lastFrameTime: 0,
    }
  },
  computed: {
    // True when a hero carousel is present. Drives section index math,
    // rail Y offsets, and whether the HeroCarousel is visible. The
    // carousel is always mounted (Blits refs inside :for get auto-
    // suffixed with the loop index, so mounting HeroCarousel via :for
    // meant $select('hero') returned null and the hero never received
    // focus, breaking arrow navigation and autoplay). Always-mounted +
    // hidden via :show avoids that trap; HeroCarousel short-circuits
    // its own autoplay when slides is empty so the hidden instance
    // does no per-tick work.
    hasHero() {
      return this.hero && this.hero.length > 0
    },
    // Where each rail is positioned within the outer container and what
    // scroll offset lands its title just below the navbar. Computed in a
    // single pass so rail Y stays authoritative for both template
    // positioning and scroll target math even when orientations mix.
    railsWithLayout() {
      const baseY = this.hasHero ? HERO_HEIGHT : CONTENT_TOP_Y
      let cursor = baseY
      return this.rails.map((rail) => {
        const { railH } = cardDimsFor(rail.orientation)
        const positioned = { ...rail, _y: cursor, _railH: railH }
        cursor += railH
        return positioned
      })
    },
    // Highest valid sectionIndex.
    maxSectionIndex() {
      return this.hasHero ? this.rails.length : this.rails.length - 1
    },
    // Target Y offset (positive number) for the current focused section.
    // ensureScrollLoopRunning negates this when handing to easeStep so
    // higher sectionIndex scrolls the content up the screen.
    scrollOffset() {
      if (this.hasHero && this.sectionIndex === 0) return 0
      const railIndex = this.hasHero ? this.sectionIndex - 1 : this.sectionIndex
      const rail = this.railsWithLayout[railIndex]
      if (!rail) return 0
      return rail._y - CONTENT_TOP_Y
    },
    // ---- Global focus-frame overlay --------------------------------------
    // The frame lives OUTSIDE the animated (:y=$animY) container so it stays
    // at fixed absolute screen coordinates. Rails slide vertically under it
    // (page scroll), cards slide horizontally under it (rail scroll), and
    // the frame itself never moves — which is what makes the app read as
    // "static focus, content flowing" the way the Rust reference does.
    //
    // The frame's size follows the currently focused rail's card dimensions
    // (portrait vs landscape resolve differently); w/h transitions in the
    // template ease that resize so the frame doesn't snap when moving
    // between rails of different orientation.
    isRailFocused() {
      if (this.hasHero && this.sectionIndex === 0) return false
      return this.rails.length > 0
    },
    focusedRail() {
      if (!this.isRailFocused) return null
      const railIndex = this.hasHero ? this.sectionIndex - 1 : this.sectionIndex
      return this.railsWithLayout[railIndex] || null
    },
    focusedRailDims() {
      const rail = this.focusedRail
      return cardDimsFor(rail ? rail.orientation : 'portrait')
    },
    frameMargin() {
      return FRAME_MARGIN
    },
    // Card step for the focused rail's orientation. Used to place the
    // frame at the peek slot — same offset the rail's scroll target uses,
    // so the focused card lands exactly where the frame sits.
    focusedCardStep() {
      return this.focusedRailDims.cardW + CARD_GAP
    },
    frameW() {
      return this.focusedRailDims.cardW + FRAME_MARGIN * 2
    },
    frameH() {
      return this.focusedRailDims.cardH + FRAME_MARGIN * 2
    },
    // Absolute screen x of the frame's top-left corner. Aligns to the card
    // that sits at the peek slot within the rail: rail x (CONTENT_PADDING_X)
    // + card inset (CARD_OFFSET_X) + peek offset (PEEK_LEFT_FRACTION * step)
    // - FRAME_MARGIN so the frame is 5px OUTSIDE the card on the left.
    frameX() {
      return (
        CONTENT_PADDING_X + CARD_OFFSET_X + PEEK_LEFT_FRACTION * this.focusedCardStep - FRAME_MARGIN
      )
    },
    // Absolute screen y of the frame's top-left corner. Sits at the fixed
    // "row of focus": below the navbar + gap, past the rail title strip,
    // at the card's inner top offset, minus the frame margin so the frame
    // is 5px OUTSIDE the card on top.
    frameY() {
      return CONTENT_TOP_Y + RAIL_TITLE_STRIP_H + CARD_INNER_TOP_Y - FRAME_MARGIN
    },
    // The bottom-bar's y within the frame element (frameH - FRAME_MARGIN).
    // Templates cannot compute this inline, so exposed as its own field.
    frameBottomBarY() {
      return this.frameH - FRAME_MARGIN
    },
    frameRightBarX() {
      return this.frameW - FRAME_MARGIN
    },
  },
  hooks: {
    init() {
      // Navbar emits this when the user presses Down/Enter to enter the page.
      this.$listen('nav:focus-content', () => this.focusCurrentSection())
    },
    destroy() {
      if (this.rafHandle) {
        cancelAnimationFrame(this.rafHandle)
        this.rafHandle = 0
      }
    },
  },
  input: {
    down() {
      if (this.sectionIndex >= this.maxSectionIndex) return
      this.sectionIndex++
      this.updateRailWindow()
      this.focusCurrentSection()
      this.ensureScrollLoopRunning()
    },
    up() {
      if (this.sectionIndex <= 0) {
        this.$emit('nav:focus-navbar')
        return
      }
      this.sectionIndex--
      this.updateRailWindow()
      this.focusCurrentSection()
      this.ensureScrollLoopRunning()
    },
    back() {
      this.$emit('nav:focus-navbar')
    },
  },
  methods: {
    // Move focus to whichever section (hero or one of the rails) is now current.
    focusCurrentSection() {
      if (this.hasHero && this.sectionIndex === 0) {
        const hero = this.$select('hero')
        if (hero) hero.$focus()
        return
      }
      const railIndex = this.hasHero ? this.sectionIndex - 1 : this.sectionIndex
      const target = this.$select(`rail${railIndex}`)
      if (target) target.$focus()
    },
    // Slide the mounted-rail window so only rails near the focused section
    // are instantiated. Must run BEFORE focusCurrentSection() so the target
    // rail is guaranteed mounted when $select() looks for it.
    updateRailWindow() {
      const railIndex = this.hasHero ? this.sectionIndex - 1 : this.sectionIndex
      this.railWinStart = Math.max(0, railIndex - RAIL_BUFFER_UP)
      this.railWinEnd = railIndex + RAIL_VISIBLE_ROWS + RAIL_BUFFER_DOWN
    },
    // Start the rAF scroll loop if it isn't already running.
    ensureScrollLoopRunning() {
      if (this.rafHandle) return
      this.lastFrameTime = performance.now()
      this.rafHandle = requestAnimationFrame((now) => this.scrollTick(now))
    },
    // Per-frame step. Eases animY toward -scrollOffset (target Y for the
    // current section) using exponential smoothing. Stops once the remaining
    // distance is below the sub-pixel settle threshold.
    scrollTick(now) {
      const dt = now - this.lastFrameTime
      this.lastFrameTime = now
      const target = -this.scrollOffset
      const remaining = target - this.animY
      if (Math.abs(remaining) < SETTLE_PX) {
        this.animY = target
        this.rafHandle = 0
        return
      }
      this.animY = easeStep(this.animY, target, dt, PAGE_SCROLL_TAU_MS)
      this.rafHandle = requestAnimationFrame((next) => this.scrollTick(next))
    },
  },
})
