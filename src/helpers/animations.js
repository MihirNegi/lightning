// Diagnostic switch. When false, transitions built via the transition()
// helper below snap instantly instead of animating. Used to A/B test whether
// scroll smoothness is bottlenecked by the tween cost per frame or by the
// underlying render cost. Leave true for normal use; flip to false to
// re-diagnose if scroll ever feels sluggish again.
export const TRANSITIONS_ENABLED = true

// Shared animation timing constants so every component animates with the same rhythm.
// base (rail horizontal scroll) stays short — user is actively interacting
// with cards, so snappy feels responsive. slow (page vertical scroll) can be
// longer for a cinematic feel because we pre-render off-screen rails via
// index.js:viewportMargin so entering rails don't cost a first-draw spike
// per frame during the scroll.
export const DURATION = {
  fast: 200,
  base: 150,
  slow: 400,
  hero: 800,
}

// Minimum time between two accepted directional key events on the same input
// handler. Prevents rapid keydown auto-repeat (~30/sec) from queuing dozens of
// state changes and making the scroll glide silently to the final target;
// instead the user sees the focus move one step at a time.
export const HOLD_THROTTLE_MS = 250

// Longer throttle for vertical page scrolling. Sized to leave a clear dwell
// window between successive scrolls when the user holds Down/Up: 400ms of
// scroll animation + ~300ms of stillness before the next press is accepted.
// Without that dwell, back-to-back animations run into each other and rails
// whip past too fast to read on a held key.
export const HOLD_THROTTLE_PAGE_MS = 700

// Shared easing curves used across focus, scroll and hero transitions.
// smooth uses ease-in-out — same closed-form cost as ease-out but the
// symmetric acceleration/deceleration reads as noticeably smoother than
// ease-out (which decelerates only at the end, so the start feels like a
// slam). bezier curves are avoided since sampling them each frame is
// measurable overhead on TV hardware during active tweens.
export const EASING = {
  smooth: 'ease-in-out',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

// Build a Blits transition config with sensible defaults. When
// TRANSITIONS_ENABLED is false, forces duration to 0 so the value snaps
// into place on the next frame — used for the animate-vs-snap diagnostic.
export function transition(value, options = {}) {
  if (!TRANSITIONS_ENABLED) return { value, duration: 0 }
  return {
    value,
    duration: options.duration || DURATION.base,
    easing: options.easing || EASING.smooth,
    delay: options.delay || 0,
  }
}
