import Blits from '@lightningjs/blits'
import { HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT } from '../constants/layout.js'
import { SCROLL_TRANSITION_DURATION, SCROLL_TRANSITION_EASING } from '../helpers/animations.js'
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
// Scroll motion: a declarative Blits :y.transition binding on the outer
// container. Each accepted press updates sectionIndex; scrollOffset
// recomputes; scrollTransition re-emits with the new target, and Blits
// interpolates the outer y toward it over SCROLL_TRANSITION_DURATION using
// SCROLL_TRANSITION_EASING. When a new press arrives mid-tween Blits
// interrupts and re-tweens from the current visual position, so held
// Down/Up chains into one continuous glide with no velocity reset.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// x=64 matches CONTENT_PADDING_X; 880 matches HERO_HEIGHT; 410 = RAIL_HEIGHT.
export default Blits.Component('PageContainer', {
  components: {
    HeroCarousel,
    ContentRail,
  },
  template: `
    <Element :y.transition="$scrollTransition">
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
    }
  },
  computed: {
    // Vertical pixel offset for the current section. Recomputes whenever
    // sectionIndex changes and feeds scrollTransition below.
    scrollOffset() {
      return getPageScrollOffset(this.sectionIndex, HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT)
    },
    // Tween config bound to the outer element's :y.transition. When
    // scrollOffset changes this re-emits; Blits interrupts any in-flight
    // tween and re-interpolates y toward the new target from the current
    // visual position, using the shared duration and easing constants.
    scrollTransition() {
      return {
        value: -this.scrollOffset,
        duration: SCROLL_TRANSITION_DURATION,
        easing: SCROLL_TRANSITION_EASING,
      }
    },
  },
  hooks: {
    init() {
      // Navbar emits this when the user presses Down/Enter to enter the page.
      this.$listen('nav:focus-content', () => this.focusCurrentSection())
    },
  },
  input: {
    down() {
      if (this.sectionIndex >= this.rails.length) return
      this.sectionIndex++
      this.updateRailWindow()
      this.focusCurrentSection()
    },
    up() {
      if (this.sectionIndex <= 0) {
        this.$emit('nav:focus-navbar')
        return
      }
      this.sectionIndex--
      this.updateRailWindow()
      this.focusCurrentSection()
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
  },
})
