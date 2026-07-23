import Blits from '@lightningjs/blits'
import { HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT } from '../constants/layout.js'
import { PAGE_SCROLL_TAU_MS, SETTLE_PX, easeStep } from '../helpers/animations.js'
import { getPageScrollOffset } from '../helpers/scroll.js'
import HeroCarousel from './HeroCarousel.js'
import ContentRail from './ContentRail.js'

// Rail virtualization window: how many rails to keep mounted around the
// focused section. Blits' :range directive uses [from, to) semantics
// (exclusive end), so the total mounted is UP + VISIBLE + DOWN. Rails
// outside this window are unmounted — their ContentRail instances are
// destroyed, freeing all their card image textures. Without this every
// rail in the page (potentially dozens) draws every frame, competing
// with the vertical scroll tween for GPU budget.
const RAIL_BUFFER_UP = 1
const RAIL_BUFFER_DOWN = 1
const RAIL_VISIBLE_ROWS = 3

// Generic page layout: hero at the top, then a vertical stack of content rails.
// Handles Up/Down navigation between sections and remembers which section was
// last focused via component state (kept alive by the router's keepAlive flag).
//
// Rail mounting: only ~5 rails (RAIL_VISIBLE_ROWS + buffers) are mounted at
// any time via Blits' :range directive. As the user scrolls Down/Up we slide
// the window with updateRailWindow(), which must run BEFORE focus moves so
// the target rail is guaranteed mounted when $select() looks for it. This
// keeps the per-frame draw cost bounded regardless of how many rails the
// page has.
//
// Scroll motion: a manual requestAnimationFrame loop (scrollTick +
// ensureScrollLoopRunning) eases animY toward the target Y using
// exponential smoothing (easeStep). Same technique the horizontal
// ContentRail uses — one shared helper, one behaviour across both axes.
// A new Up/Down press mid-motion just updates sectionIndex (which changes
// scrollOffset), and the next tick continues gliding from the current
// visual position with the new distance. There is no tween restart or
// velocity discontinuity, so held Up/Down blends into one continuous
// glide with a natural ease-out tail on release.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// x=64 matches CONTENT_PADDING_X; 880 matches HERO_HEIGHT; 410 = RAIL_HEIGHT.
export default Blits.Component('PageContainer', {
  components: {
    HeroCarousel,
    ContentRail,
  },
  template: `
    <Element :y="$animY">
      <HeroCarousel ref="hero" :slides="$hero" />
      <ContentRail
        :for="(rail, index) in $rails"
        :range="{from: $railWinStart, to: $railWinEnd}"
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
      // Index of the first rail mounted by the :range virtualization window.
      railWinStart: 0,
      // Index one past the last rail mounted by the :range window.
      // Initial value covers rails 0 to RAIL_VISIBLE_ROWS + BUFFER_DOWN
      // while the user is still on the hero.
      railWinEnd: RAIL_VISIBLE_ROWS + RAIL_BUFFER_DOWN,
      // Current animated Y for the outer container. Bound directly to the
      // template — every scrollTick assignment repositions the whole stack.
      // Kept in state (not as a plain instance property) so Blits' reactive
      // template binding actually re-renders on every update.
      animY: 0,
      // Active requestAnimationFrame id, or 0 if no loop is running. Kept
      // in state so assignments in scrollTick / ensureScrollLoopRunning are
      // visible to Blits' reactive system in the same way ContentRail does;
      // no template reads it directly so there is no re-render overhead.
      rafHandle: 0,
      // Timestamp of the last rAF tick, used to compute per-frame dt so
      // easeStep is proportional to real elapsed time and behaviour is
      // identical at 30/60/120 fps.
      lastFrameTime: 0,
    }
  },
  computed: {
    // Target Y offset (positive number) for the current focused section.
    // ensureScrollLoopRunning negates this when handing to easeStep so
    // higher sectionIndex scrolls the content up the screen.
    scrollOffset() {
      return getPageScrollOffset(this.sectionIndex, HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT)
    },
  },
  hooks: {
    init() {
      // Navbar emits this when the user presses Down/Enter to enter the page.
      this.$listen('nav:focus-content', () => this.focusCurrentSection())
    },
    // Cancel any in-flight rAF so we don't touch state on a component
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
      if (this.sectionIndex >= this.rails.length) return
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
      const ref = this.sectionIndex === 0 ? 'hero' : `rail${this.sectionIndex - 1}`
      const target = this.$select(ref)
      if (target) target.$focus()
    },
    // Slide the mounted-rail window so only rails near the focused section
    // are instantiated. Must run BEFORE focusCurrentSection() so the target
    // rail is guaranteed mounted when $select() looks for it. Same
    // virtualization idea as ContentRail.rebuildVisibleItems, but Blits'
    // declarative :range does the actual mount/unmount — we only bump the
    // window bounds.
    updateRailWindow() {
      // sectionIndex 0 is the hero; rail indices start at sectionIndex - 1.
      const railIndex = this.sectionIndex - 1
      this.railWinStart = Math.max(0, railIndex - RAIL_BUFFER_UP)
      this.railWinEnd = railIndex + RAIL_VISIBLE_ROWS + RAIL_BUFFER_DOWN
    },
    // Start the rAF scroll loop if it isn't already running. Called from
    // every accepted Up/Down press. If the loop is already running, presses
    // just update sectionIndex (and therefore the scrollOffset computed);
    // the loop picks up the new target on its next tick with no restart.
    ensureScrollLoopRunning() {
      if (this.rafHandle) return
      this.lastFrameTime = performance.now()
      this.rafHandle = requestAnimationFrame((now) => this.scrollTick(now))
    },
    // Per-frame step. Eases animY toward -scrollOffset (target Y for the
    // current section) using exponential smoothing. Stops (returns without
    // rescheduling) once the remaining distance is below the sub-pixel
    // settle threshold, so an idle page does not consume rAF slots.
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
