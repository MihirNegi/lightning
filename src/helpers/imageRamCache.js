// RAM-level LRU cache of decoded HTMLImageElement objects.
//
// Problem this solves: prefetch.js (and Blits internally) create Image()
// objects that are immediately GC'd once the request fires. The browser
// keeps the HTTP response in its network cache, but the DECODED bitmap is
// freed along with the Image reference. When Blits later needs the same URL
// for a GPU texture upload — either on first mount or after a VRAM eviction
// — it must re-decode the JPEG/PNG from the compressed bytes (~5-10ms each).
//
// This cache keeps a live HTMLImageElement reference for each preloaded URL.
// As long as the reference is alive, the browser retains the decoded bitmap
// in its image decode cache. When Blits (or prefetch.js) loads the same URL:
//   - Network: instant (HTTP cache hit)
//   - Decode:  instant (bitmap already in memory — browser skips re-decode)
//   - Upload:  one texImage2D call, same as always
//
// This mirrors likerust's ImageCache (imageCache.js cap=192, VRAM cap=96):
// two separate budgets so VRAM eviction does not lose the decoded source.
// Here the RAM budget is 150 images (roughly 150 × ~300KB decoded ≈ 45MB).
//
// LRU is Map insertion-order: the first entry is the least-recently-used.
// touch() promotes an existing entry to MRU; evict() removes the LRU tail.

const CAP = 150
/** @type {Map<string, HTMLImageElement>} */
const cache = new Map()

/**
 * Ensure a decoded HTMLImageElement for `url` is alive in the RAM cache.
 * If the URL is already cached, promotes it to MRU (no extra network hit).
 * If new, creates an Image, starts the load, and stores it immediately so
 * the reference is live throughout decode. Evicts the LRU entry when full.
 */
export function preloadImage(url) {
  if (!url) return
  if (cache.has(url)) {
    const img = cache.get(url)
    cache.delete(url)
    cache.set(url, img)
    return
  }
  if (cache.size >= CAP) {
    cache.delete(cache.keys().next().value)
  }
  const img = new Image()
  cache.set(url, img)
  img.src = url
}
