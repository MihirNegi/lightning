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

// Longer throttle for vertical page scrolling. Vertical section changes move
// the whole page a large distance, so we hold each section a bit longer
// before accepting the next press.
export const HOLD_THROTTLE_PAGE_MS = 450

// Shared easing curves used across focus, scroll and hero transitions.
// smooth uses ease-out (cheap, closed-form) rather than a cubic-bezier —
// bezier curves require solving a cubic each frame to sample the progress,
// which is measurable overhead on TV hardware during active tweens.
export const EASING = {
  smooth: 'ease-out',
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
