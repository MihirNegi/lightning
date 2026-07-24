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
        :src="$activeSrc"
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
    // Forwarded from PageContainer via ContentRail. When true, this card
    // has just mounted while the page is mid-scroll and should NOT trigger
    // its image decode or alpha fade yet — both would compete with the
    // scroll rAF for main-thread time. activeSrc + fadeTransition below
    // both gate on this. Once the card has committed to loading its image
    // once (i.e. seen a moment of isScrolling=false), it stays committed
    // for the rest of its life so subsequent scrolls don't unload textures.
    isScrolling: false,
  },
  state() {
    return {
      // Starts false so the initial render has alpha=0 on the image
      // (only the dark placeholder is visible), then flips to true in
      // the ready hook. Combined with the isScrolling gate on
      // fadeTransition, this means the fade fires only when the card
      // has mounted AND the page is at rest — never during a hold-scroll.
      hasMounted: false,
    }
  },
  hooks: {
    // Kick off the fade-in one tick after the element is in the scene
    // graph. Blits reactivity picks up the change to hasMounted and
    // Lightning tweens alpha from 0 to 1 via the transition config —
    // provided the page isn't currently scrolling (see fadeTransition).
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
    // Sticky-committed image src. Returns '' until the first moment the
    // page reports isScrolling=false, then latches on the real image URL
    // forever. Purpose: cards mounted mid-hold-scroll do NOT kick off
    // texture decodes (Lightning treats empty src as "no image"), which
    // otherwise steal main-thread time from the scroll rAF and cause the
    // stutter that hold-down currently exhibits. Once a card has been
    // seen at rest, its texture stays loaded across future scrolls — so
    // there's no repeated unload/reload churn as the user navigates.
    //
    // Reads this._srcCommitted (a plain instance field, not reactive
    // state) as a sticky latch; setting it inside the getter is a
    // deliberate one-way commit that Blits' reactivity doesn't track,
    // so this is safe.
    activeSrc() {
      if (this._srcCommitted) return this.image
      if (!this.isScrolling) {
        this._srcCommitted = true
        return this.image
      }
      return ''
    },
    // Fade in only when the card has mounted AND we've committed to
    // showing the real image (see activeSrc). Under hold-scroll this
    // means the fade never fires — src is '' and activeSrc is falsy —
    // so ~40 concurrent 200ms alpha tweens across newly-mounted cards
    // that used to pile up during a vertical hold are gone. On settle,
    // activeSrc latches and the fade plays once, masking the placeholder
    // → image texture-swap the way it always did.
    fadeTransition() {
      return transition(this.hasMounted && this.activeSrc ? 1 : 0, {
        duration: DURATION.fast,
        easing: EASING.smooth,
      })
    },
  },
})
