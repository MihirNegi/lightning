import Blits from '@lightningjs/blits'
import Navbar from './components/Navbar.js'

// Tab pages are destroyed when switching away, not cached. keepAlive:true
// only works when navigation is via $router.back(), which the Navbar
// deliberately does not do (it always calls $router.to()). Combined with
// inHistory:false, a kept-alive view was never destroyed AND never
// reachable again — every tab switch orphaned the previous page's view,
// leaking rails + card textures indefinitely. keepAlive:false frees the
// previous page cleanly on each switch. reuseComponent:false ensures a
// fresh instance on re-entry so state resets to the top of the page.
const TAB_ROUTE_OPTIONS = {
  passFocus: false,
  inHistory: false,
  keepAlive: false,
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
    // Dynamic imports — each page module (and its data helpers) is only
    // parsed/evaluated when the user first navigates to that tab, not at
    // app boot. Reduces initial parse + eval cost on TV JS engines and
    // avoids building rail data for tabs the user may never visit.
    { path: '/', component: () => import('./pages/Home.js'), options: TAB_ROUTE_OPTIONS },
    { path: '/movies', component: () => import('./pages/Movies.js'), options: TAB_ROUTE_OPTIONS },
    { path: '/shows', component: () => import('./pages/Shows.js'), options: TAB_ROUTE_OPTIONS },
    { path: '/sports', component: () => import('./pages/Sports.js'), options: TAB_ROUTE_OPTIONS },
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
