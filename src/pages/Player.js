import Blits from '@lightningjs/blits'

// Playback screen. Owns the native <video id="player-video"> element from
// index.html for its whole lifetime — attaches on ready, detaches on
// destroy. The Blits canvas sits on top of the video and renders only the
// overlay chrome (title, progress track, play/pause indicator, bottom
// scrim). App.js switches the canvas root Element to a fully transparent
// colour while this page is mounted so the underlying video composites
// through — see App.js's applyChrome() and index.js's canvasColor.
//
// Progress is driven by the browser's own timeupdate + play + pause events
// rather than a rAF poll. timeupdate fires ~4 Hz during playback which is
// plenty for a progress bar, and only fires while the video is actually
// playing — so a paused Player consumes zero per-frame work.
//
// Autoplay: user pressed Enter (a real gesture) so audio playback is
// allowed. If the browser blocks anyway (synthetic events, some strict
// policies) we retry muted so the visual still starts. Same fallback
// pattern the Rust reference uses.
export default Blits.Component('Player', {
  template: `
    <Element w="1920" h="1080">
      <Text
        :content="$title"
        size="44"
        color="#FFFFFF"
        x="128"
        y="120"
        maxwidth="1600"
        maxlines="1"
      />
      <Element x="0" y="760" w="1920" h="320" color="{top: 'rgba(0, 0, 0, 0)', bottom: 'rgba(0, 0, 0, 0.7)'}" />
      <Text
        :content="$paused ? '▶' : ''"
        size="48"
        color="#FFFFFF"
        x="128"
        y="900"
      />
      <Element :show="$isPlaying" x="128" y="908" w="12" h="40" color="#FFFFFF" />
      <Element :show="$isPlaying" x="152" y="908" w="12" h="40" color="#FFFFFF" />
      <Element x="128" y="990" w="1664" h="8" :rounded="4" color="rgba(255, 255, 255, 0.25)">
        <Element h="8" :rounded="4" color="#00B3FF" :w="$progressWidth" />
      </Element>
      <Text
        :content="$timeLabel"
        size="22"
        color="#DDDDDD"
        x="128"
        y="1014"
      />
    </Element>
  `,
  props: {
    title: '',
    image: '',
    video: '',
  },
  state() {
    return {
      // Playback clock, pushed from the DOM <video>'s timeupdate event.
      // Drives the progress bar width + the time label.
      currentTime: 0,
      // Total length in seconds. 0 until the browser fires loadedmetadata.
      duration: 0,
      // Mirrors the DOM element's paused state, driven by play + pause
      // events. Toggles the ▶ icon / two-bar pause primitive.
      paused: true,
      // Cached DOM <video> reference + the four listener function refs.
      // Kept in state so property assignments in attachVideo() take effect
      // through Blits' declared setters — direct instance-level assignment
      // (this.videoEl = v) on a Blits component is not a supported path
      // and silently fails on some engine versions.
      videoEl: null,
      onTime: null,
      onMeta: null,
      onPlay: null,
      onPause: null,
    }
  },
  computed: {
    isPlaying() {
      return !this.paused
    },
    progressWidth() {
      if (this.duration <= 0) return 0
      const frac = Math.min(Math.max(this.currentTime / this.duration, 0), 1)
      return Math.round(1664 * frac)
    },
    timeLabel() {
      return `${formatSeconds(this.currentTime)}  /  ${formatSeconds(this.duration)}`
    },
  },
  hooks: {
    // chrome:set is emitted only from ready — see the matching comment in
    // Meta.js. Back always goes to Meta (the only entry path into Player is
    // Meta), so Meta's ready hook will emit the correct chrome mode after
    // the router pop. detachVideo still runs in destroy — it just tears
    // down the DOM element listeners and is not tied to chrome state.
    ready() {
      this.$focus()
      this.$emit('chrome:set', 'player')
      this.attachVideo()
    },
    destroy() {
      this.detachVideo()
    },
  },
  input: {
    enter() {
      this.togglePlay()
    },
    back() {
      // Router back returns to the previous entry — always Meta, since
      // reaching Player always goes through Meta. Meta remounts fresh
      // (keepAlive:false) and its ready hook calls $focus + emits the
      // chrome:set 'meta' event, so nothing needs to be signalled from
      // here beyond popping the history entry.
      this.$router.back()
    },
  },
  methods: {
    // Grab the DOM video element, wire listeners, kick off playback. Handlers
    // are stored on the component instance so detachVideo can remove exactly
    // the same function references (removeEventListener requires identity).
    attachVideo() {
      const v = globalThis.document && globalThis.document.getElementById('player-video')
      if (!v) return
      this.videoEl = v
      this.onTime = () => {
        this.currentTime = v.currentTime || 0
      }
      this.onMeta = () => {
        this.duration = v.duration || 0
      }
      this.onPlay = () => {
        this.paused = false
      }
      this.onPause = () => {
        this.paused = true
      }
      v.addEventListener('timeupdate', this.onTime)
      v.addEventListener('loadedmetadata', this.onMeta)
      v.addEventListener('play', this.onPlay)
      v.addEventListener('pause', this.onPause)
      v.src = this.video
      v.style.display = 'block'
      // First attempt keeps audio; if the browser blocks it retry muted so
      // the visual at least starts. Real remote Enter is a user gesture so
      // this fallback is rarely needed.
      v.play().catch(() => {
        v.muted = true
        v.play().catch(() => {})
      })
    },
    // Reverse of attachVideo. Called from destroy() so the DOM element is
    // ready to be reused by a future Player mount.
    detachVideo() {
      const v = this.videoEl
      if (!v) return
      v.pause()
      v.removeEventListener('timeupdate', this.onTime)
      v.removeEventListener('loadedmetadata', this.onMeta)
      v.removeEventListener('play', this.onPlay)
      v.removeEventListener('pause', this.onPause)
      v.removeAttribute('src')
      v.load()
      v.style.display = 'none'
      this.videoEl = null
    },
    togglePlay() {
      const v = this.videoEl
      if (!v) return
      if (v.paused) v.play().catch(() => {})
      else v.pause()
    },
  },
})

// Format a seconds count as m:ss or h:mm:ss. Returns 0:00 for non-finite
// inputs so the label is always well-formed while the metadata is loading.
function formatSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`)
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${m}:${pad(s)}`
}
