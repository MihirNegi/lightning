import { defineConfig } from 'vite'
import blitsVitePlugins from '@lightningjs/blits/vite'

export default defineConfig({
  base: './',
  publicDir: 'static',
  plugins: [...blitsVitePlugins],
  server: {
    host: true,
    port: 5173,
  },
})
