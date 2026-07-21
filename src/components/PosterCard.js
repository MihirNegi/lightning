import Blits from '@lightningjs/blits'

// A single poster card. Renders only the poster image (with an optional
// progress bar for continue-watching rails). Focus indication is NOT drawn
// here — the parent ContentRail draws a single static frame at the focus
// slot, and cards slide underneath it. So this component doesn't need to
// know or care whether it's the currently-focused card.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// Image is 260x300; wrapper stays 260x390 so the RAIL_HEIGHT math in
// constants/layout.js and helpers/scroll.js keeps working unchanged.
export default Blits.Component('PosterCard', {
  template: `
    <Element w="260" h="390">
      <Element
        w="260"
        h="300"
        color="#FFFFFF"
        :src="$image"
        fit="cover"
      >
        <Element :show="$hasProgress" y="294" w="260" h="6" color="rgba(255, 255, 255, 0.25)">
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
  },
  computed: {
    hasProgress() {
      return typeof this.progress === 'number'
    },
    progressBarWidth() {
      if (typeof this.progress !== 'number') return 0
      const clamped = Math.min(Math.max(this.progress, 0), 1)
      return Math.round(260 * clamped)
    },
  },
})
