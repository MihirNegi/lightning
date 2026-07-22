import symbols from '@lightningjs/blits/symbols'
import { getAllImageUrls } from '../data/images.js'

// Hard references to every pre-warmed Texture. Kept at module scope so the
// JS garbage collector cannot free them and, if Lightning's cache ever
// becomes refcount-based in a future version, the entry stays live.
const pinnedTextures = []

// Ask the Lightning renderer to create and cache a Texture object for every
// image URL the app will ever use, at app-ready time. This runs BEFORE any
// user interaction, so the ~500ms of fetch+decode work happens off the
// critical path.
//
// Why it fixes mount jank: when a real PosterCard or HeroSlide later sets
// `:src="foo.jpg"`, Blits calls the same createTexture path internally.
// Lightning's CoreTextureManager keeps a URL-keyed cache (keyCache) and
// returns the pre-warmed Texture instead of re-fetching and re-decoding
// the image. The GPU upload for real usage is still queued (Lightning
// batches uploads across frames via processSome()) but is much cheaper
// because the decoded bitmap is already ready — no synchronous decode
// stall on the mount frame, which was costing 30-100ms on Vida TV.
//
// Renderer access: Blits exposes the renderer instance on every component
// via a symbol-based accessor (component/base/utils.js:46). The symbols
// module is an officially exported subpath of @lightningjs/blits, so we
// don't depend on unstable internal paths.
export function prewarmTextures(component) {
  const renderer = component[symbols.renderer]()
  for (const url of getAllImageUrls()) {
    pinnedTextures.push(renderer.createTexture('ImageTexture', { src: url }))
  }
}
