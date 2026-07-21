// Frame-timing meter. Runs its own requestAnimationFrame loop and samples
// the frame interval (dt = time between vsync ticks), then emits an averaged
// label roughly 3x/second in the format:
//   "50 fps   20.0 ms"
//
// Blits owns rendering internally, so there's no JS-side render pass to time
// as "work" — the loop only reports fps and frame interval.
//
// Returns a stop() function to cancel the loop (call from a destroy hook).
const REFRESH_MS = 300

// Start the meter. onUpdate(label) is called ~3x/second with a formatted
// string ready to bind to a Blits <Text> content prop.
export function startFpsMeter(onUpdate) {
  let last = performance.now()
  let fpsMs = 0 // accumulated frame interval across the sample window
  let fpsN = 0 // frames observed in the window
  let fpsClock = last
  let rafId = 0
  let cancelled = false

  // rAF tick: measure dt, and every REFRESH_MS emit an averaged label.
  const frame = (now) => {
    if (cancelled) return
    const dt = now - last
    last = now

    fpsMs += dt
    fpsN++

    if (now - fpsClock > REFRESH_MS) {
      const avgFrame = fpsMs / fpsN
      const label = `${Math.round(1000 / avgFrame)} fps   ${avgFrame.toFixed(1)} ms`
      onUpdate(label)
      fpsMs = 0
      fpsN = 0
      fpsClock = now
    }

    rafId = requestAnimationFrame(frame)
  }

  rafId = requestAnimationFrame(frame)

  return () => {
    cancelled = true
    if (rafId) cancelAnimationFrame(rafId)
  }
}
