// Diagnostic switch. When false, transitions built via the transition()
// helper below snap instantly instead of animating. Used to A/B test whether
// scroll smoothness is bottlenecked by the tween cost per frame or by the
// underlying render cost. Leave true for normal use; flip to false to
// re-diagnose if scroll ever feels sluggish again.
export const TRANSITIONS_ENABLED = true

// Shared animation timing constants so every component animates with the same rhythm.
// base (rail horizontal scroll) is 200ms — this is the sweet spot premium TV
// apps (Netflix, Prime, Apple TV) tend to use per card. Below 180ms feels
// twitchy on a TV screen at viewing distance; above 250ms feels sluggish
// during a held scroll. slow (page vertical scroll) is longer for a
// cinematic feel because we pre-render off-screen rails via
// index.js:viewportMargin so entering rails don't cost a first-draw spike
// per frame during the scroll.
export const DURATION = {
  fast: 200,
  base: 200,
  slow: 400,
  hero: 800,
}

// Minimum time between two accepted directional key events on the same input
// handler. Prevents rapid keydown auto-repeat (~30/sec) from queuing dozens of
// state changes and making the scroll glide silently to the final target;
// instead the user sees the focus move one step at a time.
export const HOLD_THROTTLE_MS = 250

// Rail-specific throttle. Matched exactly to DURATION.base above so that
// during a horizontal hold-scroll, one card animation ends the same tick
// the next press is accepted — no gap between chained animations. With
// the previous 250ms throttle over a 150ms animation, users saw the
// scroll decelerate to a halt, pause for ~100ms, then accelerate again,
// which reads as "stopping and going" on a held key. 200ms/200ms with a
// linear ease (see ContentRail.trackTransition) reads as one continuous
// slide at constant velocity — long enough per card to feel premium,
// short enough on hold to feel responsive.
export const HOLD_THROTTLE_RAIL_MS = 200

// Vertical page-scroll throttle. Matched exactly to DURATION.slow so
// consecutive rail-to-rail scrolls chain end-to-end with no gap when the
// user holds Down/Up — the same reasoning as HOLD_THROTTLE_RAIL_MS above.
// Previously 700ms over a 400ms animation left ~300ms of dead time per
// step, which felt like the page was jerking between rails instead of
// gliding through them. 400ms/400ms with linear easing (see
// PageContainer.scrollTransition) reads as one continuous vertical
// slide at ~2.5 rails/second.
export const HOLD_THROTTLE_PAGE_MS = 400

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
