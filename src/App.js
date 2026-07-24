import Blits from '@lightningjs/blits'
import Navbar from './components/Navbar.js'
import { STAGE_W } from './constants/layout.js'
import { SETTLE_PX, TAB_SLIDE_TAU_MS, easeStep } from './helpers/animations.js'

// Tab pages participate in history so Meta.back can pop cleanly back to the
// tab the user drilled in from. keepAlive:true caches the outgoing tab's
// view + its focused-component reference, so on back the ContentRail the
// user was on is restored — with its scroll position and focused card
// intact. To avoid the historical leak of cached views on tab-to-tab
// switches (Navbar uses router.to, not router.back), Navbar overrides
// keepAlive:false at call-time — the history entry is still recorded but
// no view is cached, so switching tabs stays memory-bounded.
const TAB_ROUTE_OPTIONS = {
  passFocus: true,
  inHistory: true,
  keepAlive: true,
  reuseComponent: false,
}

// Drill-down routes (/meta, /player) also participate in history so back
// works from Player -> Meta -> tab. keepAlive:false because a fresh mount
// on re-entry is cheap and gives deterministic focus + video state each
// time. passFocus:true lets the router hand focus to the mounted view;
// each drill page also calls this.$focus() in ready as a belt-and-braces.
const DRILL_ROUTE_OPTIONS = {
  passFocus: true,
  inHistory: true,
  keepAlive: false,
  reuseComponent: false,
}

// Tab paths — used by the afterEach router hook to decide whether to
// re-focus the Navbar after a navigation completes.
const TAB_PATHS = new Set(['/', '/movies', '/shows', '/sports', '/fps'])

export default Blits.Application({
  components: {
    Navbar,
  },
  // The outer wrapper stays transparent. A dedicated background Element
  // sits behind everything else and drives its own alpha reactively — on
  // the Player route it fades to 0 so the DOM <video> beneath the canvas
  // shows through. Using :alpha on a real element is more reliable than
  // toggling a color to rgba(...,0) on the outer wrapper, which was not
  // consistently rendered transparent by the underlying WebGL clear path.
  template: `
    <Element w="1920" h="1080">
      <Element w="1920" h="1080" color="#0B0B0B" :alpha="$bgAlpha" />
      <Element w="1920" h="1080" :x="$tabSlideX">
        <RouterView ref="router" w="1920" h="1080" />
      </Element>
      <Navbar ref="navbar" :show="$showNavbar" />
    </Element>
  `,
  state() {
    return {
      // 1 on tab + meta screens (opaque dark background matches the
      // canvasColor before Player was introduced), 0 on Player so the
      // native <video> behind the canvas composites through.
      bgAlpha: 1,
      // Hidden during drill-down modes (Meta + Player) — those are
      // full-screen contexts and the tab strip is visual noise there.
      showNavbar: true,
      // Horizontal offset of the RouterView container. 0 = at rest.
      // Snapped to ±STAGE_W the instant a tab-change event arrives so
      // the new page mounts already offscreen on the incoming side, then
      // eased back to 0 by tabSlideTick. Left → right press yields +STAGE_W
      // (new page enters from the right), right → left yields -STAGE_W.
      tabSlideX: 0,
      // Active requestAnimationFrame id for the tab-slide ease, or 0.
      // Instance-only field would suffice, but Blits state is convenient
      // and the extra reactivity dispatch on start/stop is negligible
      // compared to the tween itself.
      tabSlideRaf: 0,
      // Timestamp of the last tab-slide rAF tick for real-elapsed dt.
      tabSlideLastFrame: 0,
    }
  },
  // Blits reads routes as either an array (routes only) or an object with
  // { hooks, routes }. The object form is required to register router
  // hooks like afterEach — a top-level `routerHooks` field is silently
  // ignored by Blits' setup and the hooks never fire.
  routes: {
    hooks: {
      // Fires after every route transition finishes, including the initial
      // mount. Used to steal focus back to Navbar for tab-to-tab switches —
      // without this, passFocus:true on tab routes hands focus to the page
      // root, so pressing Right on the Navbar moves to a new tab AND loses
      // the Navbar cursor (no ancestor has left/right handlers, so keys
      // are dropped and the app appears frozen). Coming back from Meta ->
      // Home, the router has already restored the cached ContentRail focus
      // and we do NOT want to overwrite that, so we only re-focus Navbar
      // when the origin is also a tab (or the very first mount, where
      // `from` is undefined).
      afterEach(to, from) {
        if (!TAB_PATHS.has(to.path)) return
        if (from && !TAB_PATHS.has(from.path)) return
        this.focusNavbar()
      },
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
      {
        path: '/player',
        component: () => import('./pages/Player.js'),
        options: DRILL_ROUTE_OPTIONS,
      },
    ],
  },
  hooks: {
    ready() {
      // When a page presses Up on its top row, it emits this event to
      // return focus to the Navbar.
      this.$listen('nav:focus-navbar', () => this.focusNavbar())
      // Navbar emits this when back is pressed while it holds focus — the
      // user is at the app root and wants to leave.
      this.$listen('app:exit', () => this.exitApp())
      // Meta + Player emit chrome:set on ready to signal how the App
      // shell should present itself. Modes: 'tab' (opaque bg, navbar
      // visible), 'meta' (opaque bg, navbar hidden), 'player' (fully
      // transparent bg so the DOM <video> shows through, navbar hidden).
      // Meta.back also emits 'tab' explicitly since tabs never emit
      // chrome events on their own.
      this.$listen('chrome:set', (mode) => this.applyChrome(mode))
      // Navbar emits this when the user moves between tabs, carrying the
      // direction of motion (+1 right, -1 left). Snap the RouterView
      // container off-screen on the incoming side and start the ease so
      // the new page (which mounts a tick later once $router.to lands)
      // enters at that offset and glides to 0.
      this.$listen('nav:tab-change', (direction) => this.startTabSlide(direction))
    },
    destroy() {
      if (this.tabSlideRaf) {
        cancelAnimationFrame(this.tabSlideRaf)
        this.tabSlideRaf = 0
      }
    },
  },
  methods: {
    // Give keyboard focus to the top navigation bar.
    focusNavbar() {
      const navbar = this.$select('navbar')
      if (navbar) navbar.$focus()
    },
    // Update the app shell to match the mode emitted by the active page.
    // Three known modes; adding a fourth is a two-line change here.
    applyChrome(mode) {
      this.showNavbar = mode === 'tab'
      this.bgAlpha = mode === 'player' ? 0 : 1
    },
    // Seed the horizontal offset for the tab-change slide and start (or
    // continue) the ease loop. Called synchronously from the Navbar's
    // emit BEFORE $router.to runs — Blits $emit is synchronous, so by
    // the time RouterView swaps to the new page the container is
    // already at ±STAGE_W and the new page mounts offscreen.
    startTabSlide(direction) {
      this.tabSlideX = direction * STAGE_W
      this.tabSlideLastFrame = performance.now()
      if (this.tabSlideRaf) return
      this.tabSlideRaf = requestAnimationFrame((now) => this.tabSlideTick(now))
    },
    // Per-frame ease of tabSlideX toward 0. Same easeStep pattern as
    // ContentRail / PageContainer / HeroCarousel — a chained tab change
    // mid-slide just resets tabSlideX to the new incoming side and the
    // loop picks it up on the next tick without restart or discontinuity.
    tabSlideTick(now) {
      const dt = now - this.tabSlideLastFrame
      this.tabSlideLastFrame = now
      if (Math.abs(this.tabSlideX) < SETTLE_PX) {
        this.tabSlideX = 0
        this.tabSlideRaf = 0
        return
      }
      this.tabSlideX = easeStep(this.tabSlideX, 0, dt, TAB_SLIDE_TAU_MS)
      this.tabSlideRaf = requestAnimationFrame((next) => this.tabSlideTick(next))
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
