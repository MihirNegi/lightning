// Frame-timing meter plus one-shot boot diagnostics. Runs its own rAF loop
// and emits an averaged label ~3x/second in the format:
//   "50 fps   20.0 ms   GL2 60Hz"
//
// Diagnostic suffix is fixed after boot and answers two TV-specific questions:
//   - GL2 / GL1 / 2D — which renderer the browser actually gave us. Old TV
//     browsers can silently fall back to WebGL1 or Canvas 2D, which is a
//     major perf hit vs WebGL2.
//   - NNHz — the browser's true rAF cap, measured as the minimum stable
//     frame interval over the first CAP_MEASURE_FRAMES ticks. Some TV
//     browsers cap rAF at 30Hz to save power; when that's the case, no
//     amount of JS optimisation can push the fps above 30.
//
// Returns a stop() function to cancel the loop (call from a destroy hook).
const REFRESH_MS = 300

// Number of rAF ticks to sample before locking in the "cap" reading. The
// browser can only slip slower than the true vsync period, never faster, so
// taking a low-percentile of observed intervals gives the true refresh rate.
const CAP_MEASURE_FRAMES = 60

// Detect which rendering backend the browser is giving us. TV browsers on
// old Chromium sometimes silently downgrade from WebGL2, and knowing which
// one Blits is running on is the first thing to check when fps is low.
function detectRenderer() {
  try {
    const canvas = document.createElement('canvas')
    if (canvas.getContext('webgl2')) return 'GL2'
    if (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) return 'GL1'
    return '2D'
  } catch {
    return '?'
  }
}

// Estimate the browser's true rAF refresh rate from a sample of frame
// intervals. Uses the 10th-percentile interval — rAF can slip long under
// load but cannot fire faster than vsync, so the lower tail is the true
// period. Rounds to the nearest Hz.
function estimateCapHz(intervals) {
  const sorted = intervals.slice().sort((a, b) => a - b)
  const p10 = sorted[Math.floor(sorted.length * 0.1)] || sorted[0]
  return Math.round(1000 / p10)
}

// Start the meter. onUpdate(label) is called ~3x/second with a formatted
// string ready to bind to a Blits <Text> content prop.
export function startFpsMeter(onUpdate) {
  const renderer = detectRenderer()
  const capSamples = []
  let capHz = null

  let last = performance.now()
  let fpsMs = 0
  let fpsN = 0
  let fpsClock = last
  let rafId = 0
  let cancelled = false

  // rAF tick: measure dt, feed the boot cap sampler until it locks in, and
  // every REFRESH_MS emit an averaged label with the diagnostic suffix.
  const frame = (now) => {
    if (cancelled) return
    const dt = now - last
    last = now

    if (capHz === null) {
      capSamples.push(dt)
      if (capSamples.length >= CAP_MEASURE_FRAMES) {
        capHz = estimateCapHz(capSamples)
      }
    }

    fpsMs += dt
    fpsN++

    if (now - fpsClock > REFRESH_MS) {
      const avgFrame = fpsMs / fpsN
      const suffix = capHz !== null ? `${renderer} ${capHz}Hz` : `${renderer} ...`
      const label = `${Math.round(1000 / avgFrame)} fps   ${avgFrame.toFixed(1)} ms   ${suffix}`
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
