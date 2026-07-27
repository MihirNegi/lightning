import Blits from '@lightningjs/blits'
import App from './App.js'

// Suppress OS auto-repeat for directional keys. The app's per-frame hold model
// (ContentRail.holdTick / PageContainer.holdTick) controls scroll cadence from
// the RAF loop — OS repeat would bypass that and fire Blits input handlers at
// the browser's native repeat rate (~30/sec), undermining the chained-advance
// logic. Window capture-phase runs before Blits' bubble-phase listener;
// stopImmediatePropagation kills the event before it reaches Blits at all.
window.addEventListener(
  'keydown',
  (e) => {
    if (
      e.repeat &&
      (e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown')
    ) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  },
  { capture: true },
)

Blits.Launch(App, 'app', {
  w: 1920,
  h: 1080,
  debugLevel: 0,
  enableMouse: false,
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
  // GPU memory pressure controls. TV set-top boxes have tight VRAM; without
  // these Blits accumulates textures over long sessions and eventually
  // stutters. max is the hard ceiling (120 MB); target triggers proactive
  // eviction at 70% (84 MB); cleanupInterval polls every 5s (up from 3s
  // to reduce idle work — the sweep is less likely to land on a rendered
  // frame); strict evicts aggressively once target is exceeded rather
  // than waiting for max.
  gpuMemory: { max: 120e6, target: 0.7, cleanupInterval: 5000, strict: true },
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
