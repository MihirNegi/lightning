import { defineConfig } from 'vite'
import {
  injectDevConfig,
  blitsFileConverter,
  reactivityGuard,
  preCompiler,
} from '@lightningjs/blits/vite'

// MSDF generator plugin is intentionally omitted. Its native binary
// (msdf-bmfont-xml) requires GLIBC 2.38, which Vercel's build image
// doesn't ship. Instead we commit pre-generated MSDF assets in
// static/fonts/ (Roboto-Regular.msdf.png + .msdf.json + metrics/*.json)
// which are served as ordinary static files at runtime. If the font
// ever changes, re-add msdfGenerator() locally, run `npm run dev` to
// regenerate, then copy the outputs from node_modules/.tmp-msdf-fonts-v2/
// back into static/fonts/ and remove the plugin again for CI.
export default defineConfig({
  base: './',
  publicDir: 'static',
  plugins: [injectDevConfig(), blitsFileConverter(), reactivityGuard(), preCompiler()],
  server: {
    host: true,
    port: 5173,
  },
})
