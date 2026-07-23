import Blits from '@lightningjs/blits'
import { startFpsMeter } from '../helpers/fps.js'

// Diagnostics page: a distraction-free, oversized live FPS readout. Runs its
// own startFpsMeter instance independent of the Navbar's readout — the two
// are unrelated consumers of the same measurement source, and each is torn
// down with the component that owns it (Navbar meter stops if the whole app
// exits; this page's meter stops on route change via destroy hook).
//
// Uses mount="0.5" so text is anchored by its centre; positioning by x=960
// keeps the number horizontally centred on the 1920px stage regardless of
// how wide the rendered glyphs turn out to be (e.g. "8" vs "120").
//
// The page is itself focusable so Back / Up returns focus to the Navbar.
// There is no content to scroll through, so no PageContainer is needed.
export default Blits.Component('Fps', {
  template: `
    <Element w="1920" h="1080">
      <Text
        :content="$fps"
        size="480"
        color="#00B3FF"
        x="960"
        y="440"
        mount="0.5"
      />
      <Text
        content="frames per second"
        size="48"
        color="#AAAAAA"
        x="960"
        y="740"
        mount="0.5"
      />
      <Text
        :content="$details"
        size="32"
        color="#666666"
        x="960"
        y="840"
        mount="0.5"
      />
    </Element>
  `,
  state() {
    return {
      fps: '--',
      details: 'sampling frame timing...',
    }
  },
  hooks: {
    init() {
      // Take focus when the user presses Down / Enter on the Navbar. Same
      // pattern PageContainer uses, but there is no inner section here so
      // the page focuses itself.
      this.$listen('nav:focus-content', () => this.$focus())
    },
    ready() {
      this.stopFps = startFpsMeter((data) => {
        this.fps = String(data.fps)
        this.details =
          `${data.avgFrameMs.toFixed(1)} ms/frame   ` +
          `max ${data.maxDt.toFixed(1)} ms   ` +
          `${data.jankCount} jank`
      })
    },
    destroy() {
      if (this.stopFps) this.stopFps()
    },
  },
  input: {
    up() {
      this.$emit('nav:focus-navbar')
    },
    back() {
      this.$emit('nav:focus-navbar')
    },
  },
})
