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

// Meta/Player drill-down routes DO participate in history so $router.back()
// returns to the page (or Meta) the user came from. Fresh mount each time
// keeps the incoming route deterministic — same reasoning as tabs.
const DRILL_ROUTE_OPTIONS = {
  passFocus: true,
  inHistory: true,
  keepAlive: false,
  reuseComponent: false,
}

export default Blits.Application({
  components: {
    Navbar,
  },
  template: `
    <Element w="1920" h="1080" :color="$rootColor">
      <RouterView ref="router" w="1920" h="1080" />
      <Navbar ref="navbar" :show="$showNavbar" />
    </Element>
  `,
  state() {
    return {
      // Reactively set by Meta / Player as they mount and unmount so the
      // canvas surface is opaque #0B0B0B on tab + meta screens (matches the
      // canvasColor before the Player was introduced) and fully transparent
      // on Player (letting the native <video> behind the canvas show
      // through).
      rootColor: '#0B0B0B',
      // Navbar is hidden during drill-down modes (Meta + Player) — they are
      // full-screen contexts and the tab strip would be visual noise there.
      showNavbar: true,
    }
  },
  routes: [
    // Dynamic imports — each page module (and its data helpers) is only
    // parsed/evaluated when the user first navigates to that tab, not at
    // app boot. Reduces initial parse + eval cost on TV JS engines and
    // avoids building rail data for tabs the user may never visit.
    { path: '/', component: () => import('./pages/Home.js'), options: TAB_ROUTE_OPTIONS },
    { path: '/movies', component: () => import('./pages/Movies.js'), options: TAB_ROUTE_OPTIONS },
    { path: '/shows', component: () => import('./pages/Shows.js'), options: TAB_ROUTE_OPTIONS },
    { path: '/sports', component: () => import('./pages/Sports.js'), options: TAB_ROUTE_OPTIONS },
    { path: '/fps', component: () => import('./pages/Fps.js'), options: TAB_ROUTE_OPTIONS },
    { path: '/meta', component: () => import('./pages/Meta.js'), options: DRILL_ROUTE_OPTIONS },
    { path: '/player', component: () => import('./pages/Player.js'), options: DRILL_ROUTE_OPTIONS },
  ],
  hooks: {
    ready() {
      // When a page presses Up on its top row, it emits this event to
      // return focus to the Navbar (pages that support this will be built in step 4).
      this.$listen('nav:focus-navbar', () => this.focusNavbar())
      // Navbar emits this when back is pressed while it holds focus — the
      // user is at the app root and wants to leave.
      this.$listen('app:exit', () => this.exitApp())
      // Meta + Player emit chrome:set on ready/destroy to signal how the
      // App shell should present itself. Modes: 'tab' (opaque root, navbar
      // visible), 'meta' (opaque root, navbar hidden), 'player' (transparent
      // root so the DOM <video> shows through, navbar hidden). Emitting on
      // both ready + destroy keeps the state right across Meta<->Player
      // and Meta->back->tab transitions without needing a global router
      // hook.
      this.$listen('chrome:set', (mode) => this.applyChrome(mode))
      this.focusNavbar()
    },
  },
  methods: {
    // Give keyboard focus to the top navigation bar.
    focusNavbar() {
      const navbar = this.$select('navbar')
      if (navbar) navbar.$focus()
    },
    // Update the app shell to match the mode emitted by the active page.
    // Kept small and deliberate — three known modes, no lookup table, so
    // adding a mode later is a two-line change.
    applyChrome(mode) {
      this.showNavbar = mode === 'tab'
      this.rootColor = mode === 'player' ? 'rgba(0, 0, 0, 0)' : '#0B0B0B'
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
