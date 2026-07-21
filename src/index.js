import Blits from '@lightningjs/blits'
import App from './App.js'

Blits.Launch(App, 'app', {
  w: 1920,
  h: 1080,
  debugLevel: 0,
  enableMouse: false,
  viewportMargin: 600,
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
