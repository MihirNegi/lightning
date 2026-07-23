import Blits from '@lightningjs/blits'

// Details / synopsis screen for a focused item. Reached from ContentRail
// (Enter on a card) or HeroCarousel (Enter on Watch Now). Blits merges the
// data object passed to $router.to('/meta', data) into this component's
// props, so every field arrives via the declared props below.
//
// Layout: large poster left, text column right, Play button bottom-right.
// The Play button is the only focusable affordance so it renders in an
// always-highlighted state — no need for a focus indicator.
//
// Focus lifecycle: hooks.ready() calls $focus() so the input handlers below
// respond immediately on mount. On back the router pops the drill entry
// and the previous page (tab) remounts; App.js does not re-focus a tab
// automatically, so we explicitly emit nav:focus-navbar. This means focus
// returns to the Navbar rather than the exact rail card the user came from
// — the tab was destroyed on the /meta navigation (keepAlive:false), so
// its per-rail focus state was not preserved. Fixing that would require
// turning tabs into keep-alive views, which is a broader change tracked in
// App.js's TAB_ROUTE_OPTIONS comment.
export default Blits.Component('Meta', {
  template: `
    <Element w="1920" h="1080" color="#0B0B0B">
      <Element x="128" y="140" w="520" h="780" color="#1A1A1A" :src="$image" fit="cover" />
      <Element x="720" y="200" w="1050">
        <Text :content="$subtitle" size="28" color="#00B3FF" />
        <Text
          y="52"
          :content="$title"
          size="72"
          color="#FFFFFF"
          maxwidth="1050"
          maxlines="2"
          lineheight="86"
        />
        <Text
          y="240"
          :content="$description"
          size="30"
          color="#DDDDDD"
          maxwidth="1000"
          maxlines="6"
          lineheight="44"
        />
      </Element>
      <Element
        x="720"
        y="820"
        w="240"
        h="72"
        :rounded="10"
        color="#00B3FF"
        :border="{width: 2, color: '#FFFFFF'}"
      >
        <Text content="▶  Play" size="30" color="#FFFFFF" x="52" y="18" />
      </Element>
    </Element>
  `,
  props: {
    // Every field below arrives as route.data from $router.to('/meta', {...}).
    // Defaults keep the component renderable if it is somehow reached without
    // data (should not happen in normal navigation).
    title: '',
    subtitle: '',
    description: '',
    image: '',
    video: '',
  },
  hooks: {
    // chrome:set is emitted only from ready — never from destroy. The router
    // mounts the incoming view BEFORE destroying the outgoing one, so a
    // destroy-time emission would overwrite the newly-mounted view's chrome
    // state (Meta -> Player produced a one-frame navbar flash before this
    // was moved).
    ready() {
      this.$focus()
      this.$emit('chrome:set', 'meta')
    },
  },
  input: {
    // Enter goes to the Player, forwarding the same fields so Player never
    // has to re-derive them. Blits merges the passed object into Player's
    // declared props.
    enter() {
      this.$router.to('/player', {
        title: this.title,
        image: this.image,
        video: this.video,
      })
    },
    // Back pops the /meta history entry. The destination tab does not
    // emit chrome events on its own, so we emit 'tab' here before popping
    // so the shell (navbar + bg alpha) is right by the time the tab paints
    // its first frame. Focus is restored automatically by the router — tab
    // routes are keepAlive:true so the cached ContentRail focus reference
    // is applied via passFocus, returning the user to the exact card they
    // pressed Enter on.
    back() {
      this.$emit('chrome:set', 'tab')
      this.$router.back()
    },
  },
})
