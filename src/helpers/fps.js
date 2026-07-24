// Frame-timing meter. Runs its own rAF loop and emits a label ~3x/second in
// the format: "60 fps   16.7 ms   work 3.2 ms   max 42.1   3 jank"
//
// Averages hide jank: a 50ms stutter once a second barely shifts the mean but
// is what the user actually sees. So the label carries several separate
// numbers per window:
//   - average fps (baseline throughput)
//   - average frame ms (matches fps but easier to compare vs a vsync target)
//   - avg work ms per frame (main-thread busy time per frame — the closest
//     analog to the Rust reference's `engine.tick()` time we can measure
//     without a Blits render hook; see below)
//   - max frame ms (peak jank magnitude in the window)
//   - jank count (frames > 1.5x vsync, i.e. dropped at least one frame)
// Reading them together tells you whether the app is consistently slow
// (low fps, low max, high work), spiky (fine fps, high max + janks) or
// under-budget (low work, low max, high fps).
//
// About "work ms": Blits does its rendering inside an internal loop we can't
// wrap with performance.now(), so we can't time engine.tick() the way the
// Rust reference does. Instead we use the "post-a-message at frame start"
// trick: a MessageChannel message posted from inside the rAF callback is
// dispatched as a macrotask, and macrotasks only run after the browser has
// finished the current frame's script + layout + paint work. So the delta
// (dispatch time - frame start) is a reasonable estimate of how much
// main-thread time each frame actually consumed — including Blits'
// internal render pass, which happens on the main thread synchronously
// with our rAF tick. Non-zero even on idle (Blits still paints), and
// fluctuates with GC / text rasterisation / texture upload — matching the
// character of the Rust engine.tick() readout.
//
// The renderer (GL2/GL1/2D) and detected browser rAF cap are also sampled at
// boot and exposed on the data object — the cap scales the jank threshold
// correctly on 30Hz-capped browsers so a "healthy" frame there isn't
// flagged as a drop.
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
//   { label, fps, avgFrameMs, workMs, maxDt, jankCount, renderer, capHz }
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
  let workMsAccum = 0
  let fpsClock = last
  let rafId = 0
  let cancelled = false

  // Post-task probe. postMessage on a MessageChannel schedules a macrotask,
  // and macrotasks queued from inside a rAF callback don't run until AFTER
  // the browser finishes that frame's script + layout + paint. So the
  // delta between the frame's start time and the moment onmessage fires
  // is a reasonable estimate of how much main-thread time the frame
  // actually consumed — including Blits' internal render pass, which we
  // otherwise can't wrap.
  let frameStart = 0
  let lastWorkMs = 0
  const workChannel = new MessageChannel()
  workChannel.port1.onmessage = () => {
    lastWorkMs = performance.now() - frameStart
  }

  // rAF tick: measure dt, feed the boot cap sampler until it locks in, and
  // every REFRESH_MS emit a label with avg fps, avg work time, worst
  // frame in the window, and jank count. Note dt is derived from rAF
  // timestamps — if the main thread stalls for 100ms, rAF misses ~6 vsyncs
  // and the next dt reflects the full stall, so this genuinely catches
  // main-thread jank.
  const frame = (now) => {
    if (cancelled) return
    const dt = now - last
    last = now
    frameStart = now

    if (capHz === null) {
      capSamples.push(dt)
      if (capSamples.length >= CAP_MEASURE_FRAMES) {
        capHz = estimateCapHz(capSamples)
      }
    }

    fpsMs += dt
    fpsN++
    if (dt > maxDt) maxDt = dt

    // Accumulate the previous frame's measured work. lastWorkMs was set by
    // the onmessage handler after that frame's paint completed; it's zero
    // on the very first frame (no prior probe fired), which biases the
    // first window's average slightly low but is invisible after boot.
    workMsAccum += lastWorkMs

    // Jank threshold scales with the detected refresh cap. Before cap
    // locks, use the 60Hz fallback so early-boot jank still gets flagged.
    const jankThresholdMs = capHz !== null ? (1000 / capHz) * JANK_MULTIPLIER : JANK_FALLBACK_MS
    if (dt > jankThresholdMs) jankCount++

    if (now - fpsClock > REFRESH_MS) {
      const avgFrame = fpsMs / fpsN
      const fps = Math.round(1000 / avgFrame)
      const workMs = workMsAccum / fpsN
      const label =
        `${fps} fps   ` +
        `${avgFrame.toFixed(1)} ms   ` +
        `work ${workMs.toFixed(1)}   ` +
        `max ${maxDt.toFixed(1)}   ` +
        `${jankCount} jank`
      onUpdate({
        label,
        fps,
        avgFrameMs: avgFrame,
        workMs,
        maxDt,
        jankCount,
        renderer,
        capHz,
      })
      fpsMs = 0
      fpsN = 0
      maxDt = 0
      jankCount = 0
      workMsAccum = 0
      fpsClock = now
    }

    // Post AFTER accounting so this frame's paint work is what the next
    // rAF observes as lastWorkMs.
    workChannel.port2.postMessage(null)
    rafId = requestAnimationFrame(frame)
  }

  rafId = requestAnimationFrame(frame)

  return () => {
    cancelled = true
    if (rafId) cancelAnimationFrame(rafId)
    workChannel.port1.onmessage = null
  }
}
