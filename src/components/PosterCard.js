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
    // Forwarded from PageContainer via ContentRail. Two consumers:
    //   1. Read once in ready() to decide whether to skip the mount fade
    //      (see _skipInitialFade + fadeTransition).
    //   2. Read reactively by activeSrc to gate image loading. Cards that
    //      mount mid-scroll leave :src empty (no Lightning texture decode)
    //      until either the scroll settles OR the card has already loaded
    //      its image once (sticky latch). This matches the Rust reference,
    //      which gates all decode/upload work on !engine.scroll_busy() —
    //      during a fast hold, kicking off 50 texture decodes per second
    //      steals frame budget from the scroll ease, so we don't.
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
    // Flip hasMounted so fadeTransition targets alpha=1 (subject to
    // activeSrc having latched). No mid-scroll special-case is needed
    // here anymore: activeSrc is empty while isScrolling is true, and
    // fadeTransition below keeps alpha at 0 whenever activeSrc is empty
    // — so cards that mount mid-scroll simply stay hidden until the
    // scroll settles, at which point src commits and the fade fires.
    // No concurrent alpha tweens during motion.
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
    // Sticky-committed image src — the Rust "gate decode on !scroll_busy"
    // pattern. Returns '' (Lightning treats as no image, no decode kicked
    // off) until either the parent is at rest OR we've already committed
    // once. Once committed, latched permanently — Lightning caches the
    // texture and it stays visible across future scrolls, exactly like
    // Rust's LRU-cached textures keep rendering while scroll_busy is true.
    //
    // The _srcCommitted latch is a plain instance field (not reactive
    // state), so setting it inside this getter is a one-way commit that
    // doesn't retrigger any reactive dispatch. Blits tracks this.isScrolling
    // and this.image as reactive deps, so the computed re-evaluates when
    // the parent's scroll state flips or if the image URL ever changes.
    activeSrc() {
      if (this._srcCommitted) return this.image
      if (!this.isScrolling) {
        this._srcCommitted = true
        return this.image
      }
      return ''
    },
    // Reveal fades in from alpha 0 to 1 once BOTH conditions hold: the
    // component has mounted AND activeSrc has committed to a real URL.
    // Gating on activeSrc is what makes this work naturally with scroll:
    // while isScrolling is true and this card hasn't committed yet,
    // activeSrc is '' → target alpha is 0 → element hidden (no white
    // color-fallback bleeding through the dark placeholder). When scroll
    // settles, activeSrc latches on the real image URL, target alpha
    // flips to 1, and the 200ms fade plays. So all fades for cards
    // mounted during a scroll fire together at settle — never during
    // motion. Result: zero concurrent alpha tweens competing with the
    // scroll ease.
    fadeTransition() {
      const targetAlpha = this.hasMounted && this.activeSrc ? 1 : 0
      return transition(targetAlpha, {
        duration: DURATION.fast,
        easing: EASING.smooth,
      })
    },
  },
})
