// Global single RAF loop. All scroll-tick functions register here so every
// axis updates in the same frame — prevents PageContainer (vertical) and
// ContentRail (horizontal) loops from drifting out of phase with each other.
// Multiple independent requestAnimationFrame loops can fire on different
// vsync edges, causing one axis to settle a frame before the other and
// producing a visible micro-tear. One loop = one coherent frame for all motion.

const subscribers = new Set()
let rafId = 0
let lastTime = 0

/** @param {number} now */
function tick(now) {
  const dt = now - lastTime
  lastTime = now
  for (const fn of subscribers) {
    fn(dt, now)
  }
  rafId = subscribers.size > 0 ? requestAnimationFrame(tick) : 0
}

/**
 * Register a per-frame callback receiving (dt, now). Starts the loop if not
 * already running. Safe to call multiple times with the same fn — Set dedupes.
 */
export function registerTick(fn) {
  subscribers.add(fn)
  if (!rafId) {
    lastTime = performance.now()
    rafId = requestAnimationFrame(tick)
  }
}

/**
 * Remove a per-frame callback. Stops the RAF loop when no subscribers remain
 * so idle components do not hold a live loop.
 */
export function unregisterTick(fn) {
  subscribers.delete(fn)
}
