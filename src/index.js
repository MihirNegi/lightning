import Blits from '@lightningjs/blits'
import App from './App.js'

Blits.Launch(App, 'app', {
  w: 1920,
  h: 1080,
  debugLevel: 0,
  enableMouse: false,
  // Cap the render loop at 30fps. Composite of hero + rails + text
  // occasionally exceeds a 16.7ms frame budget (60fps), which drops frames
  // mid-scroll and reads as a hitch even when the tween config itself is
  // correct. 30fps gives 33ms per frame — 2x headroom — so pacing is
  // consistent. Consistent 30fps looks noticeably smoother than
  // jittery-almost-60fps for a slow scroll.
  maxFPS: 30,
  // Texture sampling quality. Trades sharpness for per-frame GPU work.
  // 'low' uses the smallest device pixel ratio — cheapest fragment shader
  // path, fewest texels sampled per quad. Softer edges on desktop dev but
  // invisible at TV viewing distance (~3m). This is the last quality lever
  // to pull before touching scene structure or draw call count.
  renderQuality: 'low',
  // Smaller offscreen render margin. Blits still rasterises nodes within
  // this many px outside the visible viewport (to hide edge pop-in when
  // scrolling), but a smaller value means fewer just-offscreen rails get
  // drawn every frame. 100 mirrors the reference tuning; 150 was drawing
  // ~one extra rail worth of work per frame for no visible benefit on TV.
  viewportMargin: 100,
  // GPU memory pressure controls, tuned to prioritise scroll smoothness:
  // keep more textures resident so cards / hero panels scrolling into view
  // hit the cache instead of triggering a re-decode + re-upload on the
  // critical frame. max is the hard ceiling (200 MB); target defers
  // proactive eviction to 80% (160 MB); cleanupInterval polls every 5s so
  // the sweep is less likely to land mid-scroll; strict:false disables
  // aggressive eviction above target — Blits only evicts when max is hit.
  // Trade-off: uses more VRAM than the previous tuning. Safe on the demo's
  // asset volume; would need re-tuning on a very tight-VRAM STB.
  gpuMemory: { max: 200e6, target: 0.8, cleanupInterval: 5000, strict: false },
  // Canvas clears fully transparent so the Player screen can composite the
  // native <video> element (positioned behind the canvas in index.html)
  // through the canvas. On every non-Player route the App root Element
  // fills the stage with an opaque #0B0B0B, so the visible background
  // colour is unchanged.
  canvasColor: 'rgba(0, 0, 0, 0)',
  // No custom fonts registered — Text falls back to the renderer's built-in
  // default (system sans-serif). MSDF is cheap per-glyph but requires atlas
  // texture upload plus a shader path on the GPU; on constrained TV
  // hardware every glyph rendered during a scroll competes with the tween
  // for frame budget. Built-in text is faster and looks acceptable on TV.
})
