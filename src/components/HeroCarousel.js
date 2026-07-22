import Blits from '@lightningjs/blits'
import { DURATION, HOLD_THROTTLE_MS } from '../helpers/animations.js'
import HeroSlide from './HeroSlide.js'

// Autoplay tuned longer than the reference (was 5s). Long enough that the user
// can read the copy on a real TV; short enough to feel alive.
const AUTOPLAY_INTERVAL = 10000

// How much the Watch Now CTA shrinks when the user presses Enter, to give
// tactile feedback. Springs back to 1 after DURATION.fast.
const CTA_BOUNCE_SCALE = 0.94

// Full-width auto-playing hero banner. Owns keyboard focus while the user is
// on the hero section of a page: Left/Right manually change slides (and
// restart the autoplay timer), Enter triggers the Watch Now bounce.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// 1920x880 matches STAGE_W and HERO_HEIGHT. x=64 matches CONTENT_PADDING_X.
// Watch Now sits at y=760 above the pagination dots at y=850.
export default Blits.Component('HeroCarousel', {
  components: {
    HeroSlide,
  },
  template: `
    <Element w="1920" h="880">
      <HeroSlide
        :for="(slide, index) in $slides"
        key="$slide.id"
        :image="$slide.image"
        :title="$slide.title"
        :subtitle="$slide.subtitle"
        :description="$slide.description"
        :active="$index === $currentIndex"
      />
      <Element
        x="64"
        y="760"
        w="220"
        h="60"
        :rounded="8"
        :color="$$hasFocus ? '#00B3FF' : 'rgba(255, 255, 255, 0.15)'"
        :border="{width: 2, color: '#FFFFFF'}"
        :scale.transition="{value: $ctaScale, duration: 200}"
      >
        <Text content="Watch Now" size="24" color="#FFFFFF" x="30" y="14" />
      </Element>
      <Element x="64" y="850">
        <Element
          :for="(slide, index) in $slides"
          key="$slide.id"
          :x="$index * 22"
          w="12"
          h="12"
          :rounded="6"
          :color="$index === $currentIndex ? '#00B3FF' : 'rgba(255, 255, 255, 0.35)'"
        />
      </Element>
    </Element>
  `,
  props: {
    slides: [],
  },
  state() {
    return {
      // Which slide is currently visible (0-based).
      currentIndex: 0,
      // Scale applied to the Watch Now button — used for the press bounce.
      ctaScale: 1,
      // Interval id for the autoplay rotation, so we can cancel/restart it.
      autoplayId: null,
      // Timestamp of the last accepted directional press, used for hold-throttling.
      lastInputAt: 0,
    }
  },
  hooks: {
    // Start rotating slides only while the hero actually has focus. Rotating
    // in the background costs frame budget (the crossfade animation on slide
    // change is the biggest per-tick expense of this page) with no user
    // benefit — nobody sees the change when they're scrolled to a rail or
    // on a different tab.
    focus() {
      this.startAutoplay()
    },
    unfocus() {
      this.stopAutoplay()
    },
    destroy() {
      this.stopAutoplay()
    },
  },
  input: {
    // Show the previous slide and restart autoplay so the user gets the full
    // dwell time on the manually-chosen slide.
    left() {
      if (!this.acceptHoldInput()) return
      if (!this.slides.length) return
      const previous = this.currentIndex === 0 ? this.slides.length - 1 : this.currentIndex - 1
      this.goToSlide(previous)
    },
    // Show the next slide and restart autoplay.
    right() {
      if (!this.acceptHoldInput()) return
      if (!this.slides.length) return
      const next = this.currentIndex === this.slides.length - 1 ? 0 : this.currentIndex + 1
      this.goToSlide(next)
    },
    // Watch Now bounce feedback. Actual navigation/playback will hook in later.
    enter() {
      this.ctaScale = CTA_BOUNCE_SCALE
      this.$setTimeout(() => {
        this.ctaScale = 1
      }, DURATION.fast)
    },
  },
  methods: {
    // Jump to a specific slide index and reset the autoplay timer.
    goToSlide(index) {
      this.currentIndex = index
      this.startAutoplay()
    },
    // (Re)start the autoplay interval. Called when the hero gains focus and
    // whenever the user manually changes slides (to reset the dwell timer).
    startAutoplay() {
      if (this.autoplayId) this.$clearInterval(this.autoplayId)
      this.autoplayId = this.$setInterval(() => {
        this.currentIndex = this.currentIndex === this.slides.length - 1 ? 0 : this.currentIndex + 1
      }, AUTOPLAY_INTERVAL)
    },
    // Cancel the autoplay interval. Called when the hero loses focus (user
    // scrolled to a rail or switched tabs) so we stop doing per-slide work
    // that nobody can see.
    stopAutoplay() {
      if (this.autoplayId) {
        this.$clearInterval(this.autoplayId)
        this.autoplayId = null
      }
    },
    // Returns true if enough time has passed since the last accepted press.
    // Records the current time so the next call is throttled. Prevents key
    // auto-repeat from flipping slides faster than the fade can play.
    acceptHoldInput() {
      const now = Date.now()
      if (now - this.lastInputAt < HOLD_THROTTLE_MS) return false
      this.lastInputAt = now
      return true
    },
  },
})
