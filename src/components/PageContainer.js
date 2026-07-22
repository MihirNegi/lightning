import Blits from '@lightningjs/blits'
import { HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT } from '../constants/layout.js'
import { SCROLL_TRANSITION_DURATION, SCROLL_TRANSITION_EASING } from '../helpers/animations.js'
import { getPageScrollOffset } from '../helpers/scroll.js'
import HeroCarousel from './HeroCarousel.js'
import ContentRail from './ContentRail.js'

// Generic page layout: hero at the top, then a vertical stack of content rails.
// Handles Up/Down navigation between sections and remembers which section was
// last focused via component state (kept alive by the router's keepAlive flag).
// All rails are mounted eagerly on init — the earlier grow-only lazy mount
// pattern was removed because mounting a rail during a scroll press caused
// a frame-budget spike (new scene-graph nodes + first-draw textures) that
// was visible as a hitch on the vertical scroll. Mounting up front costs a
// slower first paint but removes that spike from every subsequent scroll.
//
// Scroll motion: a declarative Blits :y.transition binding on the outer
// container. Each accepted press updates sectionIndex; scrollOffset
// recomputes; scrollTransition re-emits with the new target, and Blits
// interpolates the outer y toward it over SCROLL_TRANSITION_DURATION using
// SCROLL_TRANSITION_EASING. When a new press arrives mid-tween Blits
// interrupts and re-tweens from the current visual position, so held
// Down/Up chains into one continuous glide with no velocity reset. The
// eased curve is what produces the "flowing" feel — velocity varies
// continuously through each tween, unlike the constant velocity of a
// manual per-frame RAF step. No throttle is needed: key auto-repeat
// arrives faster than the tween duration, so each new press just
// re-targets the still-in-flight tween.
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
      // Mount every rail up front so scroll never triggers new mounts (which
      // otherwise steal frame budget from the vertical scroll tween). Slice
      // to a new array reference so Blits' ':for' reactivity picks it up.
      this.visibleRails = this.rails.slice()
    },
  },
  input: {
    down() {
      if (this.sectionIndex >= this.rails.length) return
      this.sectionIndex++
      this.focusCurrentSection()
    },
    up() {
      if (this.sectionIndex <= 0) {
        this.$emit('nav:focus-navbar')
        return
      }
      this.sectionIndex--
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
  },
})
