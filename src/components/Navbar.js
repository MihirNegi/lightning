import Blits from '@lightningjs/blits'
import { HOLD_THROTTLE_MS } from '../helpers/animations.js'
import { startFpsMeter } from '../helpers/fps.js'

const TABS = [
  { label: 'Home', path: '/' },
  { label: 'Movies', path: '/movies' },
  { label: 'Shows', path: '/shows' },
  { label: 'Sports', path: '/sports' },
  { label: 'FPS', path: '/fps' },
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
color="#00B3FF"
        x="64"
        y="46"
      />
      <Element :for="(tab, index) in $tabs" key="$tab.path" :x="260 + $index * 140" y="46">
        <Text
          :content="$tab.label"
          size="28"
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
      // Live-updating jank readout, e.g. "60 fps   16.7 ms   0 jank   work 0.3".
      // work is average vsync overrun per frame in the sample window (0 =
      // perfect; rising values mean the main thread is chewing budget).
      // The work + jank fields matter more than the average fps — fine
      // fps with high work or non-zero jank is the "smooth on average
      // but visibly stuttery" case we're diagnosing. The full breakdown
      // (including max frame time) lives on the /fps diagnostic page;
      // this compact readout keeps only what fits in the navbar strip.
      fpsLabel: '-- fps   --.- ms   -- jank   work --.-',
    }
  },
  hooks: {
    ready() {
      this.syncFocusIndexWithRoute()
      // Start the rAF-based meter and remember the cancel function so we can
      // stop it in destroy(). Blits state is reactive, so assigning fpsLabel
      // re-renders the readout.
      // Build the label from data fields directly rather than using
      // data.label — the shared meter's label includes a max-frame field
      // that the diagnostic /fps page wants but is noise in the compact
      // navbar strip. Order: fps -> avg frame -> jank -> work, roughly
      // "how fast is it, how long per frame, how many dropped, how much
      // budget was stolen".
      this.stopFps = startFpsMeter((data) => {
        // Build the display label first, then assign only if it actually
        // differs from the previous one. Reassigning identical text to a
        // reactive prop still triggers Blits' Text pipeline (rasterise +
        // GPU upload) even though the pixels would be the same, so an
        // early-out here avoids that cost on windows where fps + jank +
        // rounded work all happen to match the previous sample.
        const nextLabel =
          `${data.fps} fps   ` +
          `${data.avgFrameMs.toFixed(1)} ms   ` +
          `${data.jankCount} jank   ` +
          `work ${data.workMs.toFixed(1)}`
        if (nextLabel !== this.fpsLabel) this.fpsLabel = nextLabel
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
    back() {
      // Top-level back: user is at the root of the app (focus is on the
      // Navbar), so back exits the app. Handled in App.js so the exit path
      // is centralised — page-level back is already handled per-page via
      // nav:focus-navbar.
      this.$emit('app:exit')
    },
  },
  methods: {
    // Navigate to the tab at the given index and highlight it. Emits
    // `nav:tab-change` with the direction (+1 = moved right, -1 = moved
    // left) BEFORE calling $router.to so App.js can pre-position the
    // RouterView off-screen on the incoming side; the new page then
    // mounts already at that offset and eases into view. Emitting after
    // the route swap would flash the page at x=0 before jumping to the
    // off-screen start position.
    //
    // The third argument to $router.to overrides the outgoing route's
    // keepAlive to false — tabs statically keepAlive:true so a
    // drill-into-Meta caches the current tab's view, but we do NOT want
    // that behaviour on a plain tab-to-tab switch (it would leak a view
    // for every previously-visited tab). The afterEach router hook in
    // App.js pulls focus back to Navbar once the transition completes.
    selectTab(index) {
      const direction = index > this.focusIndex ? 1 : -1
      this.focusIndex = index
      this.$emit('nav:tab-change', direction)
      this.$router.to(this.tabs[index].path, {}, { keepAlive: false })
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
