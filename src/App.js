import Blits from '@lightningjs/blits'
import Navbar from './components/Navbar.js'
import Home from './pages/Home.js'
import Movies from './pages/Movies.js'
import Shows from './pages/Shows.js'
import Sports from './pages/Sports.js'

// Tab pages keep their state (scroll position, selected cards) alive when
// switching away, and do not steal focus from the Navbar automatically -
// the Navbar hands focus off to page content explicitly on Down/Enter.
const TAB_ROUTE_OPTIONS = {
  passFocus: false,
  inHistory: false,
  keepAlive: true,
  reuseComponent: false,
}

export default Blits.Application({
  components: {
    Navbar,
  },
  template: `
    <Element w="1920" h="1080" color="#0B0B0B">
      <RouterView ref="router" w="1920" h="1080" />
      <Navbar ref="navbar" />
    </Element>
  `,
  routes: [
    { path: '/', component: Home, options: TAB_ROUTE_OPTIONS },
    { path: '/movies', component: Movies, options: TAB_ROUTE_OPTIONS },
    { path: '/shows', component: Shows, options: TAB_ROUTE_OPTIONS },
    { path: '/sports', component: Sports, options: TAB_ROUTE_OPTIONS },
  ],
  hooks: {
    ready() {
      // When a page presses Up on its top row, it emits this event to
      // return focus to the Navbar (pages that support this will be built in step 4).
      this.$listen('nav:focus-navbar', () => this.focusNavbar())
      // Navbar emits this when back is pressed while it holds focus — the
      // user is at the app root and wants to leave.
      this.$listen('app:exit', () => this.exitApp())
      this.focusNavbar()
    },
  },
  methods: {
    // Give keyboard focus to the top navigation bar.
    focusNavbar() {
      const navbar = this.$select('navbar')
      if (navbar) navbar.$focus()
    },
    // Close the TV application. Tries platform-native exit APIs first
    // (Tizen on Samsung, webOS on LG) and falls back to window.close(),
    // which on browsers only succeeds if the window was opened by script.
    // globalThis is used so ESLint doesn't flag the platform globals as
    // undefined in dev, where they legitimately don't exist.
    exitApp() {
      const g = globalThis
      if (g.tizen && g.tizen.application) {
        g.tizen.application.getCurrentApplication().exit()
        return
      }
      if (g.webOS && g.webOS.platformBack) {
        g.webOS.platformBack()
        return
      }
      if (g.close) g.close()
    },
  },
})
