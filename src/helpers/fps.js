// Frame-timing meter. Ports the FPS / frame-interval / work-time logic from
// the reference main.js: it runs its own requestAnimationFrame loop, samples
// the frame interval (dt = time between vsync ticks) and the JS work done
// inside each callback, then emits an averaged label roughly 3x/second in
// the format:
//   "50 fps   20.0 ms   work 1.0 ms"
//
// The reference times engine.tick() as "work"; this app doesn't drive the
// render loop from JS (Blits owns rendering), so we time the monitor's own
// callback body as the closest analog. The value stays small in practice,
// which correctly reflects that JS is mostly idle between frames.
//
// Returns a stop() function to cancel the loop (call from a destroy hook).
const REFRESH_MS = 300

// Start the meter. onUpdate(label) is called ~3x/second with a formatted
// string ready to bind to a Blits <Text> content prop.
export function startFpsMeter(onUpdate) {
  let last = performance.now()
  let fpsMs = 0 // accumulated frame interval across the sample window
  let workMs = 0 // accumulated callback work time across the sample window
  let fpsN = 0 // frames observed in the window
  let fpsClock = last
  let rafId = 0
  let cancelled = false

  // rAF tick: measure dt, time the callback body as "work", and every
  // REFRESH_MS emit an averaged label.
  const frame = (now) => {
    if (cancelled) return
    const dt = now - last
    last = now

    const t0 = performance.now()

    fpsMs += dt
    fpsN++

    if (now - fpsClock > REFRESH_MS) {
      const avgFrame = fpsMs / fpsN
      const avgWork = workMs / fpsN
      const label = `${Math.round(1000 / avgFrame)} fps   ${avgFrame.toFixed(1)} ms   work ${avgWork.toFixed(1)} ms`
      onUpdate(label)
      fpsMs = 0
      workMs = 0
      fpsN = 0
      fpsClock = now
    }

    workMs += performance.now() - t0
    rafId = requestAnimationFrame(frame)
  }

  rafId = requestAnimationFrame(frame)

  return () => {
    cancelled = true
    if (rafId) cancelAnimationFrame(rafId)
  }
}
