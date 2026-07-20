// Shared animation timing constants so every component animates with the same rhythm.
export const DURATION = {
  fast: 200,
  base: 300,
  slow: 500,
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
export const EASING = {
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

// Build a Blits transition config with sensible defaults.
export function transition(value, options = {}) {
  return {
    value,
    duration: options.duration || DURATION.base,
    easing: options.easing || EASING.smooth,
    delay: options.delay || 0,
  }
}
