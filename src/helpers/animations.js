// Diagnostic switch. When false, transitions built via the transition()
// helper below snap instantly instead of animating. Used to A/B test whether
// scroll smoothness is bottlenecked by the tween cost per frame or by the
// underlying render cost. Leave true for normal use; flip to false to
// re-diagnose if scroll ever feels sluggish again.
export const TRANSITIONS_ENABLED = true

// Shared animation timing constants so every component animates with the same rhythm.
// base is the fallback duration for the transition() helper below. The
// horizontal rail scroll no longer uses this — ContentRail drives its own
// RAF-based continuous-velocity scroll loop with TIME_PER_CARD_MS defined
// locally. slow (page vertical scroll) can be longer for a cinematic feel
// because we pre-render off-screen rails via index.js:viewportMargin so
// entering rails don't cost a first-draw spike per frame during the scroll.
//wow
export const DURATION = {
  fast: 200,
  base: 150,
  slow: 260,
  hero: 800,
}

// Minimum time between two accepted directional key events on the same input
// handler. Prevents rapid keydown auto-repeat (~30/sec) from queuing dozens of
// state changes and making the scroll glide silently to the final target;
// instead the user sees the focus move one step at a time.
export const HOLD_THROTTLE_MS = 250

// Rail-specific throttle. Matched exactly to ContentRail's TIME_PER_CARD_MS
// (150ms) so held-key auto-repeat produces at most one accepted press per
// card-time interval. The RAF loop in ContentRail moves at constant velocity
// implied by that same TIME_PER_CARD_MS, so throttle = card-time gives
// exactly one card of motion per accepted press — smooth continuous scroll
// during hold with no target-vs-motion drift.
export const HOLD_THROTTLE_RAIL_MS = 150

// Duration for the vertical page scroll tween. Long relative to the key
// auto-repeat interval (~50-100ms) on purpose: while the user holds
// Down/Up each new press interrupts the still-in-flight tween, so Blits
// re-tweens from the current visual position with the same easing curve.
// The visible motion during a hold is a chain of overlapping tweens whose
// eased slopes blend into one continuous glide; the full duration only
// plays out on the last tween after the user releases, which is what
// gives the scroll its unhurried "flowing" tail.
export const SCROLL_TRANSITION_DURATION = 800

// Easing curve for the vertical page scroll tween. Aggressive front-loaded
// ease-out: steep slope at t=0 so each newly-triggered tween immediately
// picks up visible velocity, then decelerates smoothly. This is what
// produces continuously-varying velocity within each tween — a linear or
// symmetric ease reads as mechanical because velocity is constant in the
// middle, whereas this curve is always changing pace.
export const SCROLL_TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

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
