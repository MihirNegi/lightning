import Blits from '@lightningjs/blits'
import { DURATION, EASING, transition } from '../helpers/animations.js'
import { CARD_W_PORTRAIT, CARD_H_PORTRAIT } from '../constants/layout.js'

// A single poster card. Renders a dark placeholder immediately and fades the
// poster image in on top over ~200ms. The placeholder makes the initial
// state look intentional (like Netflix/Hotstar's dark card slots) rather
// than a bright white flash, and the fade cushions the moment the network-
// fetched image actually lands from the Picsum API — so the user sees a
// smooth "content settling in" rather than a hard pop when latency varies.
//
// Focus indication is NOT drawn here — the parent ContentRail draws a
// single static frame at the focus slot, and cards slide underneath it.
// So this component doesn't need to know or care whether it's the currently
// focused card.
//
// Dimensions are prop-driven so the same component can render a portrait
// (260x310) or a landscape (460x260) card. The outer wrapper is `cardH`
// tall; the image is `imageH` tall (10px shorter than the wrapper) so
// there's a strip below the image for the progress bar to sit in without
// overlapping the poster art.
export default Blits.Component('PosterCard', {
  template: `
    <Element :w="$cardW" :h="$cardH">
      <Element :w="$cardW" :h="$imageH" color="#1A1A1A" />
      <Element
        :w="$cardW"
        :h="$imageH"
        color="#FFFFFF"
        :src="$image"
        fit="cover"
        :alpha.transition="$fadeTransition"
      >
        <Element :show="$hasProgress" :y="$progressY" :w="$cardW" h="6" color="rgba(255, 255, 255, 0.25)">
          <Element h="6" color="#00B3FF" :w="$progressBarWidth" />
        </Element>
      </Element>
    </Element>
  `,
  props: {
    title: '',
    genre: '',
    image: '',
    progress: undefined,
    cardW: CARD_W_PORTRAIT,
    cardH: CARD_H_PORTRAIT,
  },
  state() {
    return {
      // Starts false so the initial render has alpha=0 on the image
      // (only the dark placeholder is visible), then flips to true in
      // the ready hook which triggers the fade-in transition. This is a
      // mount-time fade, not tied to actual texture load, but that's
      // enough to hide the abrupt "network image just arrived" pop
      // that Picsum's variable latency was causing.
      hasMounted: false,
    }
  },
  hooks: {
    // Kick off the fade-in one tick after the element is in the scene
    // graph. Blits reactivity picks up the change to hasMounted and
    // Lightning tweens alpha from 0 to 1 via the transition config.
    ready() {
      this.hasMounted = true
    },
  },
  computed: {
    hasProgress() {
      return typeof this.progress === 'number'
    },
    // Image occupies wrapper height minus a 10px strip reserved for the
    // progress bar. Same for both orientations so the progress bar always
    // sits in a consistent slot below the artwork.
    imageH() {
      return this.cardH - 10
    },
    progressY() {
      return this.imageH - 6
    },
    progressBarWidth() {
      if (typeof this.progress !== 'number') return 0
      const clamped = Math.min(Math.max(this.progress, 0), 1)
      return Math.round(this.cardW * clamped)
    },
    // Fade-in on mount. DURATION.fast (200ms) is short enough that a card
    // sliding into the visible window during a horizontal hold-scroll
    // completes its fade before the next accepted press, and long enough
    // that the fade feels intentional rather than a technical animation.
    fadeTransition() {
      return transition(this.hasMounted ? 1 : 0, {
        duration: DURATION.fast,
        easing: EASING.smooth,
      })
    },
  },
})
