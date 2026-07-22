import Blits from '@lightningjs/blits'
import { HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT } from '../constants/layout.js'
import { DURATION, HOLD_THROTTLE_PAGE_MS, transition } from '../helpers/animations.js'
import { getPageScrollOffset } from '../helpers/scroll.js'
import HeroCarousel from './HeroCarousel.js'
import ContentRail from './ContentRail.js'

// Grow-only lazy mount for rails: start with a small prefix mounted, and
// extend the mounted range as the user scrolls down. Rails stay mounted once
// visited so scroll-back is instant and image textures don't re-load. This
// gives the big win (small first-paint on initial load) without the ref /
// reindexing complexity of a sliding window.
const RAIL_INITIAL_MOUNT = 4
const RAIL_MOUNT_AHEAD = 3

// Generic page layout: hero at the top, then a vertical stack of content rails.
// Handles Up/Down navigation between sections and remembers which section was
// last focused via component state (kept alive by the router's keepAlive flag).
// Rails are lazy-mounted grow-only (see visibleRails) so first paint is cheap.
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
      // Contiguous prefix of rails currently mounted. Grows as the user scrolls
      // down (see ensureMounted). Must be a state field (not computed) because
      // Blits ':for' effects are scoped to the specific state key they read and
      // don't re-fire on computed changes.
      visibleRails: [],
      // Timestamp of the last accepted directional press, used for hold-throttling.
      lastInputAt: 0,
    }
  },
  computed: {
    scrollOffset() {
      return getPageScrollOffset(this.sectionIndex, HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT)
    },
    scrollTransition() {
      // Linear easing (not ease-in-out) so a vertical hold-scroll reads
      // as one continuous slide rather than a sequence of rail-by-rail
      // decelerate-halt-accelerate steps. With HOLD_THROTTLE_PAGE_MS
      // matched to DURATION.slow, chained rail transitions run back-to-
      // back with no gap; linear velocity means the whole page slides
      // upward at a constant rate through the held key — same treatment
      // as ContentRail.trackTransition uses for horizontal card scroll.
      return transition(-this.scrollOffset, { duration: DURATION.slow, easing: 'linear' })
    },
  },
  hooks: {
    init() {
      // Navbar emits this when the user presses Down/Enter to enter the page.
      this.$listen('nav:focus-content', () => this.focusCurrentSection())
      // Seed the initial visible prefix now that props are available.
      const initial = Math.min(RAIL_INITIAL_MOUNT, this.rails.length)
      this.visibleRails = this.rails.slice(0, initial)
    },
  },
  input: {
    down() {
      if (!this.acceptHoldInput()) return
      if (this.sectionIndex >= this.rails.length) return
      this.sectionIndex++
      this.ensureMounted(this.sectionIndex - 1 + RAIL_MOUNT_AHEAD)
      this.focusCurrentSection()
    },
    up() {
      if (!this.acceptHoldInput()) return
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
    // Grow the mounted range so that at least `throughIndex` (0-based rail
    // index) is included. Called on Down-scroll so the next few rails are
    // ready before the user can reach them. Never shrinks. Assigning a new
    // array reference is required for Blits' ':for' effect to re-fire —
    // mutating in place would not trigger the reactive setter.
    ensureMounted(throughIndex) {
      const needed = Math.min(throughIndex + 1, this.rails.length)
      if (needed > this.visibleRails.length) {
        this.visibleRails = this.rails.slice(0, needed)
      }
    },
    // Returns true if enough time has passed since the last accepted press.
    // Records the current time so the next call is throttled. Prevents key
    // auto-repeat from queuing dozens of section changes on a single hold.
    // Uses the longer page throttle (vertical scroll moves the whole page).
    acceptHoldInput() {
      const now = Date.now()
      if (now - this.lastInputAt < HOLD_THROTTLE_PAGE_MS) return false
      this.lastInputAt = now
      return true
    },
  },
})
