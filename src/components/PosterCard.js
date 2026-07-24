import Blits from '@lightningjs/blits'
import { DURATION, EASING, transition } from '../helpers/animations.js'
import { CARD_W_PORTRAIT, CARD_H_PORTRAIT } from '../constants/layout.js'

// A single poster card. Renders a slate placeholder immediately and fades the
// poster image in on top over ~200ms. The placeholder needs enough contrast
// against the #0B0B0B page background (5%) to read as a distinct card shape
// while images are still fetching — Picsum on a TV connection can take a
// couple of seconds per card, and if the placeholder blends into the page
// the rail LOOKS empty on the right (breaking the cutout-at-edge signal
// which relies on visible cards flowing past the clip boundary). #262626
// sits at ~15% brightness — visibly a card, still muted enough that the
// image fade-in reads as content settling in rather than a hard pop.
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
      <Element :w="$cardW" :h="$imageH" color="#262626" />
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
    // Forwarded from PageContainer via ContentRail. Read once at ready()
    // to decide whether this card should fade in (parent at rest) or
    // snap in (parent mid-scroll). Deliberately NOT reactive after mount
    // — we don't want scrolls that start later to hide already-visible
    // cards, and we don't want to re-fade cards on every settle.
    isScrolling: false,
  },
  state() {
    return {
      // Starts false so the initial render has alpha=0 on the image
      // (only the dark placeholder is visible), then flips to true in
      // the ready hook. See fadeTransition for how mid-scroll mounts
      // bypass the fade entirely so their alpha snaps to 1 instead.
      hasMounted: false,
    }
  },
  hooks: {
    // Decide the mount-fade behavior once, based on the parent's scroll
    // state AT MOUNT time. Cards that mount mid-hold-scroll skip the
    // 200ms alpha fade — during a sustained vertical hold, ~40 cards
    // mount in quick succession and their concurrent alpha tweens
    // otherwise steal enough main-thread time to visibly hurt the
    // scroll ease. The decision is sticky (stored as a plain instance
    // field, not reactive state) so cards don't flip behavior if scroll
    // starts/stops later.
    ready() {
      if (this.isScrolling) {
        this._skipInitialFade = true
      }
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
    // Mount-time alpha reveal. Two behaviors depending on parent state
    // AT the moment ready() fired:
    //   - Parent at rest → normal 200ms fade from alpha 0 to 1 (see the
    //     original UX rationale: mask the placeholder → texture-swap pop
    //     when the Picsum image finally arrives).
    //   - Parent mid-scroll → skip the fade, snap alpha to 1. Cards are
    //     visible immediately, images load as usual — the saving is the
    //     avoided cost of ~40 concurrent 200ms alpha tweens during a
    //     vertical hold, which was the tween-storm hurting smoothness.
    // _skipInitialFade is set once in ready() and never cleared, so the
    // decision is stable for the card's lifetime.
    fadeTransition() {
      if (this._skipInitialFade) {
        return { value: 1, duration: 0 }
      }
      return transition(this.hasMounted ? 1 : 0, {
        duration: DURATION.fast,
        easing: EASING.smooth,
      })
    },
  },
})
