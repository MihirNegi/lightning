import symbols from '@lightningjs/blits/symbols'
import { getAllImageUrls } from '../data/images.js'

// Hard references to every pre-warmed Texture. Kept at module scope so the
// JS garbage collector cannot free them and, if Lightning's cache ever
// becomes refcount-based in a future version, the entry stays live.
const pinnedTextures = []

// Pre-warm Lightning's texture pipeline for every image URL the app will
// ever use, at app-ready time. Runs BEFORE any user interaction so fetch,
// decode and GPU upload happen off the critical path.
//
// Two-step process — createTexture alone is not enough:
//   1. createTexture(...) creates a Texture object and adds it to the
//      CoreTextureManager URL-keyed cache. It does NOT trigger any fetch,
//      decode, or upload — the Texture is just a shell keyed by URL.
//   2. txManager.loadTexture(texture) actually kicks off the work: calls
//      texture.getTextureData() (async fetch + decode via ImageWorker),
//      then enqueues the texture into the upload queue which is drained
//      one-per-frame by processSome() during the render loop.
//
// When a real PosterCard or HeroSlide later sets `:src="foo.jpg"`, Blits
// calls createTexture with the same src → cache hit → returns our pinned
// Texture. The CoreNode's own loadTexture call then sees texture.state ===
// 'loaded' and returns immediately (CoreTextureManager.js:124). No fetch,
// no decode, no upload — just a state-machine short-circuit.
//
// Renderer access: Blits exposes the renderer instance on every component
// via a symbol-based accessor (component/base/utils.js:46). The symbols
// module is an officially exported subpath of @lightningjs/blits, so we
// don't depend on unstable internal paths.
//
// loadTexture returns a Promise, but we deliberately do NOT await — the
// 36 loads run in parallel over the first few seconds of the app's life.
// Fetch happens in a Web Worker (off-main), decode happens in the browser
// image pipeline, and upload is queued for the render loop. By the time
// the user starts scrolling, all 36 textures should be resident.
export function prewarmTextures(component) {
  const renderer = component[symbols.renderer]()
  const txManager = renderer.stage.txManager
  for (const url of getAllImageUrls()) {
    const texture = renderer.createTexture('ImageTexture', { src: url })
    pinnedTextures.push(texture)
    // Fire-and-forget: catch to avoid unhandled rejection warnings if a
    // URL happens to be missing, but otherwise let the load complete in
    // the background at Lightning's own pace.
    txManager.loadTexture(texture).catch(() => {})
  }
}
