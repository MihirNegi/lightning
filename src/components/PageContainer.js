import Blits from '@lightningjs/blits'
import {
  CONTENT_PADDING_X,
  HERO_HEIGHT,
  NAVBAR_HEIGHT,
  NAVBAR_TOP_GAP,
  cardDimsFor,
} from '../constants/layout.js'
import {
  PAGE_SCROLL_TAU_MS,
  SETTLE_PX,
  easeStep,
  HOLD_SCROLL_DELAY_MS,
  HOLD_AHEAD,
} from '../helpers/animations.js'
import { registerTick, unregisterTick } from '../helpers/rafLoop.js'
import { prefetchImages } from '../helpers/prefetch.js'
import HeroCarousel from './HeroCarousel.js'
import ContentRail, { FRAME_MARGIN } from './ContentRail.js'

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
// destroyed, freeing all their card image textures. Note the window
// slides one rail per focus-crossing regardless of buffer size, so
// buffers control coverage/memory, not mount frequency.
const RAIL_BUFFER_UP = 1
// Increased to 2 so the next two rails are always pre-mounted ahead of the
// viewport. Mount bursts (7 PosterCards created at once) now fire 1 extra
// rail-height earlier — during frames where the animation has budget to
// absorb the ~15ms init cost rather than mid-flight at the visible boundary.
const RAIL_BUFFER_DOWN = 2
const RAIL_VISIBLE_ROWS = 3

// How many rails PAST the mounted window to warm the HTTP image cache
// for on scroll-settle. Same idea as Rust's LOAD_RADIUS beyond the on-
// screen set — by the time the user scrolls those rails into view, their
// posters have already fetched, so decode + GPU upload lands on a cached
// blob rather than a cold network request. Kept tight because prefetch
// still competes with the current viewport's image traffic on the same
// HTTP/2 connection.
const RAIL_PREFETCH_LOOKAHEAD = 2
// How many cards from the head of each prefetched rail to warm. The card-
// window in ContentRail is 8 wide, but only the leftmost 3-4 are visible
// on the first mount before the rail's own scroll settles. Prefetching
// beyond that competes with visible cards for connection slots.
const PREFETCH_CARDS_PER_RAIL = 4

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
// at any time via Blits' :range directive. The window is derived from
// the current VISUAL scroll position (animY) inside scrollTick, not from
// sectionIndex — so as animY eases toward its target the window slides
// with it, mounting rails just before they enter the viewport. By settle
// time the target rail is already mounted for focus().
//
// Scroll motion: a manual requestAnimationFrame loop (scrollTick +
// ensureScrollLoopRunning) eases animY toward the target Y using
// exponential smoothing (easeStep) with PAGE_SCROLL_TAU_MS. Input is
// NOT throttled — held-key auto-repeat advances sectionIndex/target at
// the browser's native rate, so the ease chases a smoothly-moving
// target rather than lurching between discrete rest points. See the
// note in helpers/animations.js for the flow-vs-staircase rationale.
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
          :isScrolling="$isScrolling"
        />
      </Element>
      <Element
        :x="$frameX"
        :y="$frameY"
        :w="$frameW"
        :h="$frameH"
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
      // True while animY is actively easing toward a target. Cascaded down
      // through ContentRail into PosterCard so cards that mount mid-scroll
      // snap alpha to 1 instead of running a 200ms fade. Cleared on the
      // scrollTick settle branch when position reaches the target.
      isScrolling: false,
      // Frame overlay constants — promoted from computed to state so Blits
      // does not re-evaluate them on every reactive cycle during scroll.
      // These values are pure compile-time constants; they never change.
      frameMargin: FRAME_MARGIN,
      frameX: CONTENT_PADDING_X - FRAME_MARGIN,
      frameY: CONTENT_TOP_Y + RAIL_TITLE_STRIP_H + CARD_INNER_TOP_Y - FRAME_MARGIN,
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
    //
    // Cached against the current $rails prop reference: scrollTick calls
    // updateRailWindow() every rAF frame (~60x/sec) which reads this array,
    // and rebuilding N spread-objects on every read added measurable GC
    // pressure. Since props.rails is set once at mount and does not change
    // during a keepAlive page's lifetime, a reference-equality check
    // returns the same array for every subsequent read without recomputing.
    // If parent ever swaps the rails prop, the ref changes and the cache
    // rebuilds automatically.
    railsWithLayout() {
      if (this._railsCacheKey !== this.rails) {
        this._railsCacheKey = this.rails
        const baseY = this.hasHero ? HERO_HEIGHT : CONTENT_TOP_Y
        let cursor = baseY
        this._railsCache = this.rails.map((rail) => {
          const { railH } = cardDimsFor(rail.orientation)
          // Explicit field forwarding + a getter for `items` — the source
          // rail's items array is materialised lazily on first access
          // (see contentFactory.js). Spreading `{...rail}` would trigger
          // the getter for every rail during layout math, forcing all
          // items to build on tab mount and undoing the laziness. The
          // getter forwards each access to the source rail so mounted
          // ContentRail instances still see items as a plain array, but
          // rails outside the virtualisation window never touch it.
          const positioned = {
            id: rail.id,
            title: rail.title,
            orientation: rail.orientation,
            _y: cursor,
            _railH: railH,
          }
          Object.defineProperty(positioned, 'items', {
            enumerable: true,
            configurable: true,
            get() {
              return rail.items
            },
          })
          cursor += railH
          return positioned
        })
        // Reset the O(1) rail-index cache — a new rails array invalidates
        // the previous "closest rail" bookkeeping.
        this._lastRailIdx = 0
      }
      return this._railsCache
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
    // (portrait vs landscape resolve differently). x/w/h are bound WITHOUT
    // transitions — frameX is a compile-time constant, frameY is static,
    // and frameW/frameH only change when the focused rail's orientation
    // flips. Under sustained hold-scroll, tweening those changes stacked
    // overlapping 200ms transitions on every accepted press and materially
    // hurt smoothness; snapping is imperceptible during fast transit and
    // barely noticeable on a single step between mixed-orientation rails.
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
    // frameMargin / frameX / frameY are compile-time constants — kept in
    // state() above so Blits skips their re-evaluation on every scroll frame.
    frameW() {
      return this.focusedRailDims.cardW + FRAME_MARGIN * 2
    },
    frameH() {
      return this.focusedRailDims.cardH + FRAME_MARGIN * 2
    },
    // The bottom-bar's y within the frame element (frameH - FRAME_MARGIN).
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
      this.prefetchAdjacentRails()
      // Listen for keyup to stop the hold tick when the user releases Up/Down.
      // Registered for the lifetime of the component (always mounted via keepAlive).
      this._pageKeyupFn = (e) => {
        if (e.key === 'ArrowDown' && this._heldDir === 1) this.stopHold()
        else if (e.key === 'ArrowUp' && this._heldDir === -1) this.stopHold()
      }
      document.addEventListener('keyup', this._pageKeyupFn)
    },
    destroy() {
      if (this._pageKeyupFn) document.removeEventListener('keyup', this._pageKeyupFn)
      this.stopHold()
      if (this._scrollActive && this._scrollTickFn) {
        unregisterTick(this._scrollTickFn)
        this._scrollActive = false
      }
    },
  },
  input: {
    // Initial press: advance one section and start the hold timer. OS auto-repeat
    // is suppressed in index.js so this fires only once per physical keydown.
    // ensureHoldRunning registers a per-frame hold-advance tick (likerust model).
    down() {
      if (this.sectionIndex >= this.maxSectionIndex) {
        this.stopHold()
        return
      }
      this.sectionIndex++
      this._heldDir = 1
      this._heldMs = 0
      this.updateRailWindow()
      this.ensureScrollLoopRunning()
      this.ensureHoldRunning()
      // Hero → first rail: move focus immediately so the user sees the rail
      // focus ring on the first press. Without this, focus is deferred to
      // scroll settle (~1s at tau=200ms) — no visual feedback, so the user
      // presses again, overshooting to rail 1. Rail→rail transitions keep
      // deferred focus to avoid the title-fade firing on every hold press.
      if (this.hasHero && this.sectionIndex === 1) this.focusCurrentSection()
    },
    up() {
      if (this.sectionIndex <= 0) {
        this.stopHold()
        this.$emit('nav:focus-navbar')
        return
      }
      this.sectionIndex--
      this._heldDir = -1
      this._heldMs = 0
      this.updateRailWindow()
      this.ensureScrollLoopRunning()
      this.ensureHoldRunning()
      // First rail → hero: move focus immediately so the Watch Now button
      // lights up on the first press (mirrors the down() hero→rail fix).
      if (this.hasHero && this.sectionIndex === 0) this.focusCurrentSection()
    },
    back() {
      this.$emit('nav:focus-navbar')
    },
  },
  methods: {
    // Move focus to whichever section (hero or one of the rails) is now
    // current. Called from the nav:focus-content entry path (immediate) and
    // from scrollTick's settle branch (deferred until motion completes) so
    // Blits' focus swap (and its 200ms title-fade transition on both the
    // outgoing and incoming rail) fires exactly once per hold-burst rather
    // than once per accepted press.
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
    // Update the mounted-rail window from sectionIndex. Called only when
    // sectionIndex changes (not every animation frame) so ContentRail
    // lifecycle events never fire mid-animation — that was the source of
    // per-frame ~20ms mount spikes that dragged vertical-scroll FPS to 38.
    // With RAIL_BUFFER_DOWN = 1, the next rail is pre-mounted the moment
    // sectionIndex advances, well before animY reaches it.
    updateRailWindow() {
      const rails = this.railsWithLayout
      if (rails.length === 0) return
      const railIndex = this.hasHero ? Math.max(0, this.sectionIndex - 1) : this.sectionIndex
      const newStart = Math.max(0, railIndex - RAIL_BUFFER_UP)
      const newEnd = Math.min(rails.length, railIndex + RAIL_VISIBLE_ROWS + RAIL_BUFFER_DOWN)
      if (newStart !== this.railWinStart) this.railWinStart = newStart
      if (newEnd !== this.railWinEnd) this.railWinEnd = newEnd
    },
    // Warm the browser HTTP cache for images on rails just past the mounted
    // window. Fires only when the vertical scroll has settled so it never
    // competes with the on-screen scroll for main-thread budget or
    // connection slots — the same "quiet during motion" gate that
    // PosterCard's activeSrc uses. The prefetch helper further defers each
    // batch to requestIdleCallback and dedupes URLs, so calling this on
    // every settle is safe.
    prefetchAdjacentRails() {
      const rails = this.railsWithLayout
      if (rails.length === 0) return
      const idx = this.hasHero ? Math.max(0, this.sectionIndex - 1) : this.sectionIndex
      const firstBeyond = idx + RAIL_VISIBLE_ROWS + RAIL_BUFFER_DOWN
      const lastBeyond = Math.min(rails.length - 1, firstBeyond + RAIL_PREFETCH_LOOKAHEAD - 1)
      const urls = []
      for (let r = firstBeyond; r <= lastBeyond; r++) {
        const rail = rails[r]
        if (!rail) continue
        const items = rail.items
        if (!items) continue
        const cap = Math.min(PREFETCH_CARDS_PER_RAIL, items.length)
        for (let i = 0; i < cap; i++) {
          const url = items[i] && items[i].image
          if (url) urls.push(url)
        }
      }
      if (urls.length) prefetchImages(urls)
    },
    // Register the hold-advance tick with the global RAF loop. Reuses the
    // bound fn across presses — safe to call on every Down/Up keydown.
    ensureHoldRunning() {
      if (this._holdActive) return
      this._holdActive = true
      if (!this._holdTickFn) this._holdTickFn = (dt) => this.holdTick(dt)
      registerTick(this._holdTickFn)
    },
    // Per-frame: accumulate hold time; after HOLD_SCROLL_DELAY_MS advance one
    // section per frame when animation is within HOLD_AHEAD rail-heights of the
    // current target — likerust's _holdAdvanceRail / _chainHeld pattern.
    holdTick(dt) {
      if (!this._heldDir) return
      this._heldMs += dt
      if (this._heldMs < HOLD_SCROLL_DELAY_MS) return
      this.holdAdvanceSection()
    },
    // Advance one section if the animation has caught up within HOLD_AHEAD ×
    // current rail height. Stops hold at boundaries so the tick unregisters.
    holdAdvanceSection() {
      const dir = this._heldDir
      const target = -this.scrollOffset
      const ahead = dir > 0 ? this.animY - target : target - this.animY
      const railH = this.focusedRail ? this.focusedRail._railH : 386
      if (ahead >= HOLD_AHEAD * railH) return
      if (dir > 0 && this.sectionIndex < this.maxSectionIndex) {
        this.sectionIndex++
        this.updateRailWindow()
        this.ensureScrollLoopRunning()
        this.prefetchAdjacentRails()
      } else if (dir < 0 && this.sectionIndex > 0) {
        this.sectionIndex--
        this.updateRailWindow()
        this.ensureScrollLoopRunning()
        this.prefetchAdjacentRails()
      } else {
        this.stopHold()
      }
    },
    // Clear held-key state and unregister the hold tick from the RAF loop.
    stopHold() {
      this._heldDir = null
      this._heldMs = 0
      if (this._holdActive && this._holdTickFn) {
        unregisterTick(this._holdTickFn)
        this._holdActive = false
      }
    },
    // Register with the global RAF loop if not already running. Also flips
    // isScrolling so cards downstream defer image src loading until settle.
    ensureScrollLoopRunning() {
      if (this._scrollActive) return
      this._scrollActive = true
      if (!this.isScrolling) this.isScrolling = true
      if (!this._scrollTickFn) this._scrollTickFn = (dt) => this.scrollTick(dt)
      registerTick(this._scrollTickFn)
    },
    // Per-frame step driven by the global RAF loop. dt is real elapsed time —
    // frame-rate independent easing. On settle, unregisters from the global
    // loop and fires focus once so Blits' title fade plays once per
    // hold-burst rather than per press.
    scrollTick(dt) {
      const target = -this.scrollOffset
      const remaining = target - this.animY
      if (Math.abs(remaining) < SETTLE_PX) {
        this.animY = target
        this._scrollActive = false
        if (this.isScrolling) this.isScrolling = false
        unregisterTick(this._scrollTickFn)
        this.updateRailWindow()
        this.focusCurrentSection()
        this.prefetchAdjacentRails()
        return
      }
      this.animY = easeStep(this.animY, target, dt, PAGE_SCROLL_TAU_MS)
    },
  },
})
