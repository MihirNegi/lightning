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
    // MSDF font: Blits' Vite plugin generates fonts/Roboto-Regular.msdf.png
    // and .msdf.json from public/fonts/Roboto-Regular.ttf on demand. GPU
    // renders glyphs from the atlas without per-frame rasterization, so text
    // is essentially free during scroll animations.
    {
      family: 'roboto',
      type: 'msdf',
      file: 'fonts/Roboto-Regular',
    },
  ],
})
