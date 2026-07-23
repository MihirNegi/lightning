// Frame-timing meter plus one-shot boot diagnostics. Runs its own rAF loop
// and emits a label ~3x/second in the format:
//   "60 fps   16.7 ms   max 42.1   3 jank   GL2 60Hz"
//
// Averages hide jank: a 50ms stutter once a second barely shifts the mean but
// is what the user actually sees. So the label carries three separate numbers
// per window — average fps (baseline), worst frame in the window (peak jank
// magnitude), and jank count (frames > 1.5x vsync period, i.e. dropped at
// least one frame). Reading the three together tells you whether the app is
// consistently slow (low fps, low max) or spiky (fine fps, high max + janks).
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

// A frame counts as "jank" if it takes at least this multiple of the
// baseline vsync period. 1.5x means dropping one full frame @60Hz (33ms >
// 25ms threshold) is caught, but a single ~20ms borderline frame is not.
// Scales automatically to 30Hz caps (threshold becomes 50ms there).
const JANK_MULTIPLIER = 1.5

// Fallback jank threshold used before the boot cap sampler has locked in
// capHz. 25ms corresponds to 1.5x a 60Hz period — the common case.
const JANK_FALLBACK_MS = 25

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

// Start the meter. onUpdate(data) is called ~3x/second with a structured
// object so callers can render the parts they want:
//   { label, fps, avgFrameMs, maxDt, jankCount, renderer, capHz }
// label is the pre-formatted string used by the small Navbar readout; the
// individual fields let the diagnostics page render the fps number huge and
// the rest as fine print.
export function startFpsMeter(onUpdate) {
  const renderer = detectRenderer()
  const capSamples = []
  let capHz = null

  let last = performance.now()
  let fpsMs = 0
  let fpsN = 0
  let maxDt = 0
  let jankCount = 0
  let fpsClock = last
  let rafId = 0
  let cancelled = false

  // rAF tick: measure dt, feed the boot cap sampler until it locks in, and
  // every REFRESH_MS emit a label with avg fps, worst frame in the window,
  // and jank count. Note dt is derived from rAF timestamps — if the main
  // thread stalls for 100ms, rAF misses ~6 vsyncs and the next dt reflects
  // the full stall, so this genuinely catches main-thread jank.
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
    if (dt > maxDt) maxDt = dt
    // Jank threshold scales with the detected refresh cap. Before cap
    // locks, use the 60Hz fallback so early-boot jank still gets flagged.
    const jankThresholdMs = capHz !== null ? (1000 / capHz) * JANK_MULTIPLIER : JANK_FALLBACK_MS
    if (dt > jankThresholdMs) jankCount++

    if (now - fpsClock > REFRESH_MS) {
      const avgFrame = fpsMs / fpsN
      const fps = Math.round(1000 / avgFrame)
      const suffix = capHz !== null ? `${renderer} ${capHz}Hz` : `${renderer} ...`
      const label =
        `${fps} fps   ` +
        `${avgFrame.toFixed(1)} ms   ` +
        `max ${maxDt.toFixed(1)}   ` +
        `${jankCount} jank   ` +
        suffix
      onUpdate({
        label,
        fps,
        avgFrameMs: avgFrame,
        maxDt,
        jankCount,
        renderer,
        capHz,
      })
      fpsMs = 0
      fpsN = 0
      maxDt = 0
      jankCount = 0
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
