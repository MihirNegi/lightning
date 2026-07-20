import Blits from '@lightningjs/blits'
import App from './App.js'

Blits.Launch(App, 'app', {
  w: 1920,
  h: 1080,
  debugLevel: 0,
  enableMouse: false,
  viewportMargin: 150,
  canvasColor: '#0B0B0B',
  defaultFont: 'roboto',
  fonts: [
    {
      family: 'roboto',
      type: 'web',
      file: 'fonts/Roboto-Regular.ttf',
    },
  ],
})
