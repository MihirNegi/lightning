import Blits from '@lightningjs/blits'
import App from './App.js'

Blits.Launch(App, 'app', {
  w: 1920,
  h: 1080,
  debugLevel: 0,
  enableMouse: false,
  // Cap the render loop at 30fps. On TV hardware the composite of hero +
  // rails + MSDF text occasionally exceeds a 16.7ms frame budget (60fps),
  // which drops frames mid-scroll and reads as a hitch even when the tween
  // config itself is correct. Capping at 30fps gives 33ms per frame — 2x
  // the headroom — so pacing is consistent. Consistent 30fps looks
  // noticeably smoother than jittery-almost-60fps for a slow scroll.
  maxFPS: 30,
  viewportMargin: 150,
  canvasColor: '#0B0B0B',
  defaultFont: 'roboto',
  fonts: [
    // MSDF font. Blits derives the atlas URLs by replacing the extension:
    //   file → atlasUrl:     'fonts/Roboto-Regular.ttf' → '.msdf.png'
    //   file → atlasDataUrl: 'fonts/Roboto-Regular.ttf' → '.msdf.json'
    // so the .ttf suffix MUST stay in the config even though only the .msdf
    // files are actually fetched at runtime. Assets live in static/fonts/
    // (pre-generated — see vite.config.js for the reason).
    {
      family: 'roboto',
      type: 'msdf',
      file: 'fonts/Roboto-Regular.ttf',
    },
  ],
})
