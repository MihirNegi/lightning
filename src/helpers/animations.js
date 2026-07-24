// Diagnostic switch. When false, transitions built via the transition()
// helper below snap instantly instead of animating. Used to A/B test whether
// scroll smoothness is bottlenecked by the tween cost per frame or by the
// underlying render cost. Leave true for normal use; flip to false to
// re-diagnose if scroll ever feels sluggish again.
export const TRANSITIONS_ENABLED = true

// Shared animation timing constants for Blits declarative transitions
// (:alpha.transition, :scale.transition, and the hero slide). The two
// scroll axes do NOT use these values — ContentRail (horizontal) and
// PageContainer (vertical) drive their own rAF loops with easeStep(), so
// their timing is set by RAIL_SCROLL_TAU_MS and PAGE_SCROLL_TAU_MS below.
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

// Neither the page's Up/Down input (PageContainer) nor a rail's Left/Right
// input (ContentRail) is hold-throttled. Held-key browser auto-repeat
// (~30/sec) drives sectionIndex / selectedIndex directly, so both scroll
// targets advance as smooth ramps rather than as discrete jumps every N
// milliseconds. Exponential smoothing tracking a smoothly-moving target
// reaches a steady state where position velocity equals target velocity —
// per-frame movement becomes near-constant, and the eye reads that as
// "flow" rather than a staircase of eased steps. This matches the Rust
// reference's motion model exactly (Rust throttles neither axis and uses
// SMOOTH_TAU_MS = 90 for both). On release, target stops advancing and
// position eases the residual steady-state lag to zero — giving the
// momentum-like coast-and-settle that a throttled model can't produce.

// Exponential-smoothing time constants (in milliseconds) for the rAF scroll
// loops in ContentRail (horizontal) and PageContainer (vertical). Each loop
// calls easeStep() every frame; TAU controls the perceived "weight".
// Smaller TAU = snappier (position tracks target more tightly, less coast
// on release). At steady state during a held key, position velocity equals
// target velocity regardless of TAU — so TAU controls response character,
// not sustained scroll speed. Both axes match the Rust reference at 90.
// To make holds *faster* than the target-velocity ceiling, see the
// HOLD_ADVANCE mechanism in ContentRail — that skips cards per press
// during a detected hold, doubling the effective velocity.
export const RAIL_SCROLL_TAU_MS = 90
export const PAGE_SCROLL_TAU_MS = 90

// Tab-to-tab horizontal page slide. Larger tau than the scroll axes
// because the distance travelled is a full stage width (1920 px) vs a
// single card / rail height. 180ms matches the Rust reference's
// HERO_SLIDE_TAU_MS so the personality of a tab change reads the same on
// both apps — snappy initial motion, settled by ~500ms.
export const TAB_SLIDE_TAU_MS = 180

// Distance from target below which an rAF ease loop snaps and cancels
// itself. Exponential smoothing asymptotes — without a threshold the loop
// would run forever chasing sub-pixel differences. 0.5 px is invisible at
// TV viewing distance and small enough that the snap isn't perceptible.
export const SETTLE_PX = 0.5

// One step of exponential smoothing. Given a current value, a target, and
// the real elapsed frame time in ms, returns the new value one frame closer
// to the target. Frame-rate independent (uses real dt), never overshoots,
// and — critically for TV UX — velocity is always proportional to distance
// remaining. So when a new press retargets mid-motion, the next frame just
// continues from the current position with the new distance; there is no
// tween restart, no fresh duration budget, and no velocity discontinuity
// at the moment of retargeting. Repeated presses under hold blend into one
// continuous glide with a natural ease-out tail on release.
export function easeStep(current, target, dtMs, tauMs = RAIL_SCROLL_TAU_MS) {
  const k = 1 - Math.exp(-dtMs / tauMs)
  return current + (target - current) * k
}

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
