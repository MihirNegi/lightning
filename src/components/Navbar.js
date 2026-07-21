import Blits from '@lightningjs/blits'
import { HOLD_THROTTLE_MS } from '../helpers/animations.js'
import { startFpsMeter } from '../helpers/fps.js'

const TABS = [
  { label: 'Home', path: '/' },
  { label: 'Movies', path: '/movies' },
  { label: 'Shows', path: '/shows' },
  { label: 'Sports', path: '/sports' },
]

// Top navigation bar. Owns keyboard focus while the user is browsing tabs.
// Left/Right cycle tabs (and switch routes), Down/Enter hand focus down into
// the current page's content by emitting a global event.
//
// Template pixel values are literals because Blits parses templates at build
// time and cannot interpolate JS. Kept in sync with constants/layout.js:
//   1920 = STAGE_W, 130 = NAVBAR_HEIGHT, 64 = CONTENT_PADDING_X.
//   Tabs start at x=260 (logo width) and are spaced 140px apart.
export default Blits.Component('Navbar', {
  template: `
    <Element w="1920" h="130" color="rgba(11, 11, 11, 0.95)" z="100">
      <Text
        content="lightDemo"
        size="40"
        font="roboto"
        color="#00B3FF"
        x="64"
        y="46"
      />
      <Element :for="(tab, index) in $tabs" key="$tab.path" :x="260 + $index * 140" y="46">
        <Text
          :content="$tab.label"
          size="28"
          font="roboto"
          :color="$index === $focusIndex ? '#FFFFFF' : '#AAAAAA'"
        />
        <Element
          y="42"
          h="4"
          :rounded="2"
          color="#00B3FF"
          :w.transition="{value: $index === $focusIndex ? 70 : 0, duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)'}"
        />
      </Element>
      <Text
        :content="$fpsLabel"
        size="24"
        font="roboto"
        color="#FFFFFF"
        x="1120"
        y="52"
      />
    </Element>
  `,
  state() {
    return {
      tabs: TABS,
      focusIndex: 0,
      // Timestamp of the last accepted directional press, used for hold-throttling.
      lastInputAt: 0,
      // Live-updating jank readout, e.g. "60 fps   16.7 ms   max 42.1   3 jank   GL2 60Hz".
      // The max + jank fields matter more than the average — a fine fps
      // number with a high max and non-zero jank count is exactly the
      // "smooth on average but visibly stuttery" case we're diagnosing.
      // Suffix shows the detected renderer + rAF cap so we can tell if the
      // browser is throttling frames. Refreshed ~3x/sec by the FPS meter.
      fpsLabel: '-- fps   --.- ms   max --.-   -- jank   ...',
    }
  },
  hooks: {
    ready() {
      this.syncFocusIndexWithRoute()
      // Start the rAF-based meter and remember the cancel function so we can
      // stop it in destroy(). Blits state is reactive, so assigning fpsLabel
      // re-renders the readout.
      this.stopFps = startFpsMeter((label) => {
        this.fpsLabel = label
      })
    },
    focus() {
      this.syncFocusIndexWithRoute()
    },
    destroy() {
      if (this.stopFps) this.stopFps()
    },
  },
  input: {
    left() {
      if (!this.acceptHoldInput()) return
      if (this.focusIndex <= 0) return
      this.selectTab(this.focusIndex - 1)
    },
    right() {
      if (!this.acceptHoldInput()) return
      if (this.focusIndex >= this.tabs.length - 1) return
      this.selectTab(this.focusIndex + 1)
    },
    down() {
      this.$emit('nav:focus-content')
    },
    enter() {
      this.$emit('nav:focus-content')
    },
  },
  methods: {
    // Navigate to the tab at the given index and highlight it.
    selectTab(index) {
      this.focusIndex = index
      this.$router.to(this.tabs[index].path)
    },
    // Highlight whichever tab matches the current route (e.g. on boot or focus).
    syncFocusIndexWithRoute() {
      const current = this.$router.currentRoute.path
      const matchIndex = this.tabs.findIndex((tab) => tab.path === current)
      if (matchIndex >= 0) this.focusIndex = matchIndex
    },
    // Returns true if enough time has passed since the last accepted press.
    // Records the current time so the next call is throttled. Prevents key
    // auto-repeat from cycling tabs faster than the underline can animate.
    acceptHoldInput() {
      const now = Date.now()
      if (now - this.lastInputAt < HOLD_THROTTLE_MS) return false
      this.lastInputAt = now
      return true
    },
  },
})
