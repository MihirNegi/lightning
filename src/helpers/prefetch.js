// Warm the browser's HTTP image cache for URLs we expect to need soon.
//
// The renderer's texture pipeline (Blits -> WebGL) fetches image URLs
// through Blits' own loader; that loader still ends up going through the
// browser's HTTP cache, so a prior new Image() fetch for the same URL
// short-circuits the network round-trip. We use raw new Image() (not
// fetch()) so the request is treated as an "image" resource by the
// browser — same fetch priority + cache bucket as the eventual real
// load, so the cache hit is deterministic.
//
// Scheduling: requestIdleCallback runs the batch only when the main
// thread is genuinely idle, so the prefetch never competes with a scroll
// ease or an in-progress texture upload. On browsers without rIC (older
// Chromium in some TV builds), a short-delay setTimeout with a synthetic
// deadline is used — same shape, slightly less precise idle-detection.
//
// Dedup: a module-level Set remembers URLs we've already warmed for the
// life of the tab. Repeated calls with overlapping URLs skip the already-
// warmed ones for free, so callers don't need to track state themselves.

const warmed = new Set()

// Feature-detect once at module load. Falls back to a synthetic deadline
// with a fixed 8ms budget — comparable to what rIC returns during idle.
const scheduleIdle =
  typeof globalThis.requestIdleCallback === 'function'
    ? globalThis.requestIdleCallback.bind(globalThis)
    : (cb) =>
        setTimeout(() => {
          const start = performance.now()
          cb({ timeRemaining: () => Math.max(0, 8 - (performance.now() - start)) })
        }, 60)

// Kick off HTTP fetches for the given URLs during the next idle window,
// budget-limited so we never spend more than the idle deadline in one go.
// Extras are handed to the next idle callback so a large batch drains
// across multiple idle windows rather than blowing through one.
export function prefetchImages(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return
  const pending = []
  for (const url of urls) {
    if (url && !warmed.has(url)) pending.push(url)
  }
  if (pending.length === 0) return
  scheduleIdle((deadline) => drainBatch(pending, deadline))
}

// Fire new Image() for each URL until the idle deadline is exhausted.
// Any URLs we didn't get to are re-queued for the next idle callback so
// we make forward progress across multiple windows without blocking.
function drainBatch(pending, deadline) {
  let i = 0
  while (i < pending.length && deadline.timeRemaining() > 0) {
    const url = pending[i++]
    if (warmed.has(url)) continue
    warmed.add(url)
    // No handlers attached — we only want the browser to fetch and cache
    // the resource. Assigning src kicks off the request; the Image object
    // is then GC'd once this function returns, which is fine because the
    // HTTP response is cached at the browser level, not held by the ref.
    const img = new Image()
    img.src = url
  }
  if (i < pending.length) {
    const rest = pending.slice(i)
    scheduleIdle((next) => drainBatch(rest, next))
  }
}
