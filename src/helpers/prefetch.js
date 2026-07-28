// Warm the browser's HTTP + decoded-image cache for URLs we expect soon.
//
// Two-tier caching (mirrors likerust's ImageCache + WebGL2Renderer split):
//   Tier 1 — HTTP cache: network response stored by the browser.
//   Tier 2 — RAM cache: live HTMLImageElement kept in imageRamCache.js LRU
//             so the decoded bitmap is NOT freed between HTTP hit and GPU
//             upload. Without this, Blits must re-decode from compressed
//             bytes (~5-10ms per image) on every VRAM eviction + re-mount.
//             With it, re-upload is decode-free: browser serves the bitmap
//             straight from memory.
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

import { preloadImage } from './imageRamCache.js'

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
    // preloadImage keeps a live HTMLImageElement in the RAM LRU cache so
    // the decoded bitmap survives past this call. The browser reuses the
    // decoded bitmap when Blits loads the same URL later — no re-decode
    // needed even after a VRAM eviction. HTTP caching still applies too.
    preloadImage(url)
  }
  if (i < pending.length) {
    const rest = pending.slice(i)
    scheduleIdle((next) => drainBatch(rest, next))
  }
}
