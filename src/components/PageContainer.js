import Blits from '@lightningjs/blits'
import { HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT } from '../constants/layout.js'
import { DURATION, EASING, transition } from '../helpers/animations.js'
import { getPageScrollOffset } from '../helpers/scroll.js'
import HeroCarousel from './HeroCarousel.js'
import ContentRail from './ContentRail.js'

// Generic page layout: hero at the top, then a vertical stack of content rails.
// Handles Up/Down navigation between sections and remembers which section was
// last focused via component state (kept alive by the router's keepAlive flag).
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// x=64 matches CONTENT_PADDING_X; 880 matches HERO_HEIGHT; 506 = RAIL_HEIGHT.
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
        key="$rail.id"
        :ref="'rail' + $index"
        x="64"
        :y="880 + $index * 506"
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
    }
  },
  computed: {
    scrollOffset() {
      return getPageScrollOffset(this.sectionIndex, HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT)
    },
    scrollTransition() {
      return transition(-this.scrollOffset, { duration: DURATION.slow, easing: EASING.smooth })
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
