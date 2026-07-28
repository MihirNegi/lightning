# CONTEXT.md — Full Codebase Reference

A complete technical map of this repository: what it is, how it is structured, how it works, and why key decisions were made.

For the pixel-level rendering explanation, see [CODE_WALKTHROUGH.md](CODE_WALKTHROUGH.md).  
For Lightning.js framework concepts, see [LIGHTNING_JS_STUDY.md](LIGHTNING_JS_STUDY.md).

---

## 1. What This Project Is

**lightDemo** is a production-grade Smart TV streaming UI reference implementation — think Netflix, Disney+, or Prime Video — built on [@lightningjs/blits](https://lightningjs.io/blits/).

It targets Smart TVs (Samsung Tizen, LG webOS, generic Chromium) where DOM-based UIs are too slow. Instead of HTML, the entire UI is drawn onto a single WebGL 2 canvas. Every element — navbar, hero banner, card grid, text, image — is a GPU-rendered rectangle. There is no React, no Vue, no DOM diffing.

**Design resolution:** 1920×1080 (auto-scaled to the real screen by Blits)  
**Target FPS:** 30 (capped; retained-mode scene graph runs well at 30 without pacing artifacts)  
**Framework:** Blits v2.7 (Lightning web, component-based, reactive, GPU-rendering)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | `@lightningjs/blits@^2.7.0` |
| Build | `vite@^5.4.8` + Blits Vite plugins |
| Language | JavaScript (ES modules, no TypeScript) |
| Linting | ESLint 9 + Prettier (single quotes, no semicolons, 2-space indent) |
| Git hooks | Husky + lint-staged (pre-commit lint) |
| Fonts | Roboto MSDF atlas (pre-generated, committed to `static/fonts/`) |
| Images | `https://picsum.photos` (seeded deterministic placeholders) |
| Video | Sample MP4 from `https://samplelib.com` (Big Buck Bunny, 5MB) |

**What is NOT used:** React, Vue, Angular, HTML templates for UI, CSS layout, DOM events for scrolling.

---

## 3. Directory Structure

```
light demo/
├── src/
│   ├── index.js                  # App bootstrap — Blits.Launch config
│   ├── App.js                    # Root shell — router, tab slides, chrome modes
│   │
│   ├── components/
│   │   ├── Navbar.js             # Top nav bar (5 tabs + live FPS readout)
│   │   ├── PageContainer.js      # Page layout (hero + rail stack, vertical scroll)
│   │   ├── ContentRail.js        # Horizontal card rail (hold-scroll, window virtualization)
│   │   ├── PosterCard.js         # Single card (image, title, genre, progress bar)
│   │   ├── HeroCarousel.js       # Auto-playing hero banner (wrapping scroll)
│   │   └── HeroSlide.js          # One hero slide (full-bleed image + gradient + copy)
│   │
│   ├── pages/
│   │   ├── Home.js               # Home tab (hero + 20 rails, portrait cards)
│   │   ├── Movies.js             # Movies tab (20 rails, portrait cards)
│   │   ├── Shows.js              # Shows tab (20 rails, landscape cards)
│   │   ├── Sports.js             # Sports tab (20 rails, landscape cards)
│   │   ├── Meta.js               # Item detail (poster left, text right, Play button)
│   │   ├── Player.js             # Video player overlay (DOM <video> behind canvas)
│   │   └── Fps.js                # Diagnostics page (oversized FPS readout)
│   │
│   ├── data/
│   │   ├── contentFactory.js     # createRail / createHeroSlides (lazy item generation)
│   │   ├── home.js               # Home tab data definition
│   │   ├── movies.js             # Movies tab data definition
│   │   ├── shows.js              # Shows tab data definition
│   │   ├── sports.js             # Sports tab data definition
│   │   └── images.js             # buildPosterImages / buildHeroImages (seeded Picsum URLs)
│   │
│   ├── constants/
│   │   ├── layout.js             # STAGE_W/H, card dimensions, cardDimsFor() helper
│   │   └── theme.js              # COLORS palette, FONTS config
│   │
│   └── helpers/
│       ├── animations.js         # easeStep (exponential smoothing), timing constants
│       ├── fps.js                # startFpsMeter (rAF-based, jank detection, work-ms)
│       ├── rafLoop.js            # Global RAF loop (registerTick / unregisterTick)
│       └── prefetch.js           # prefetchImages (requestIdleCallback HTTP cache warm)
│
├── index.html                    # Entry: #app div, #player-video, module script
├── vite.config.js                # Blits Vite plugins (converter, reactivity guard, precompiler)
├── eslint.config.js              # ESLint + Prettier config
├── package.json                  # Scripts, dependencies
├── settings.json                 # Blits stage settings (passed to Blits.Launch)
├── metadata.json                 # App identity (name, identifier, version, icon)
├── static/fonts/                 # Pre-built Roboto MSDF atlas + metrics JSON
├── public/                       # Static assets (served as-is)
└── dist/                         # Vite build output
```

---

## 4. Application Architecture

### 4.1 Boot Sequence

```
index.html
  └─ src/index.js
        ├─ Suppresses OS keyboard auto-repeat for arrow keys
        └─ Blits.Launch(App, 'app', { w:1920, h:1080, maxFPS:30, ... })
              └─ Blits creates <canvas> inside #app
                    └─ App.js mounts: router + Navbar + page slot
```

Key settings in `src/index.js`:
- `maxFPS: 30` — Capped to avoid frame-pacing artifacts on TV (retained-mode graph at 60 causes consistent 14–17ms overhead)
- `renderQuality: 'low'` — Smallest device pixel ratio; cheapest GPU fragment shader pass
- `viewportMargin: 100` — Culls nodes >100px outside viewport (textures freed from VRAM)
- `gpuMemory: { max: 120MB, target: 70%, cleanupInterval: 5s, strict: true }` — VRAM pressure controls
- `canvasColor: 'rgba(0,0,0,0)'` — Transparent so DOM `<video>` shows through in Player mode

### 4.2 Routing

App.js defines 7 routes:

| Route | Component | keepAlive | Chrome Mode |
|---|---|---|---|
| `/` | Home | true | `tab` |
| `/movies` | Movies | true | `tab` |
| `/shows` | Shows | true | `tab` |
| `/sports` | Sports | true | `tab` |
| `/fps` | Fps | true | `tab` |
| `/meta` | Meta | false | `meta` |
| `/player` | Player | false | `player` |

Tab routes use `keepAlive: true` — their Blits component stays mounted while drilling into Meta/Player, so navigating back restores scroll position instantly. Drill routes use `keepAlive: false` — each visit is a fresh mount for deterministic state.

### 4.3 Chrome Modes

The app shell reacts to `$emit('chrome:set', mode)` fired by pages:

| Mode | Navbar | Background |
|---|---|---|
| `tab` | Visible | Opaque (#0B0B0B) |
| `meta` | Hidden | Opaque |
| `player` | Hidden | Transparent (canvas alpha 0, video shows through) |

### 4.4 Focus Model

Blits has a global focus owner. The focus chain is:

```
App  →  Navbar  →  PageContainer  →  ContentRail  →  PosterCard
                               ↘  HeroCarousel  →  HeroSlide
```

- **Navbar** handles Left/Right (tab switching), Down (delegate to page content), Back (exit app)
- **PageContainer** handles Up (return to Navbar), Down (next rail), Left/Right (pass to ContentRail)
- **ContentRail** handles Left/Right (card scroll), Enter (navigate to /meta), Up/Down (pass back to PageContainer)

After tab-to-tab navigation, the App's `afterEach` router hook re-focuses Navbar so the user never gets a dead input state.

---

## 5. Scroll & Animation System

### 5.1 Exponential Easing (`src/helpers/animations.js`)

All motion uses one function:

```js
easeStep(current, target, dtMs, tauMs)
// returns: current + (target - current) * (1 - exp(-dtMs / tauMs))
```

Properties:
- **Frame-rate independent:** Uses real elapsed time `dtMs`, not frame count
- **Never overshoots:** Asymptotic approach toward target
- **Velocity ∝ distance:** Near target it slows; re-targeting mid-motion just redirects, no discontinuity
- **Settles when:** `|current - target| < SETTLE_PX (0.5px)`

Timing constants:

| Constant | Value | Used For |
|---|---|---|
| `RAIL_SCROLL_TAU_MS` | 110ms | Horizontal card scroll (snappy) |
| `PAGE_SCROLL_TAU_MS` | 200ms | Vertical rail scroll (weighted) |
| `TAB_SLIDE_TAU_MS` | 180ms | Page slide transition (full 1920px width) |
| `HOLD_SCROLL_DELAY_MS` | 200ms | Delay before continuous hold-scroll activates |
| `HOLD_AHEAD` | 1.0 | Runway of cards to keep ahead during hold |
| `RELEASE_MIN_RUN` | 0.4 | Minimum travel before release-coast activates |
| `SETTLE_PX` | 0.5 | Convergence threshold |

### 5.2 Global RAF Loop (`src/helpers/rafLoop.js`)

A single `requestAnimationFrame` loop that all scrolling components subscribe to:

```js
registerTick(fn)    // fn(dt, now) called every frame
unregisterTick(fn)  // remove when component unmounts
```

Auto-starts when the first subscriber registers; auto-stops when the last unregisters. All scroll axes (horizontal rail + vertical page) update in the same frame pass — no micro-tears between axes.

### 5.3 Hold-Scroll Pattern

The app **suppresses OS keyboard auto-repeat** on arrow keys (set up in `src/index.js`). Instead, it implements its own per-frame advance:

1. `keydown` fires once → start animation toward next card/rail
2. After `HOLD_SCROLL_DELAY_MS` of held key → register a per-frame tick that continuously advances the target
3. `keyup` fires → unregister the tick; let easeStep coast to final position

This gives **consistent, frame-rate-controlled scrolling** regardless of OS auto-repeat rate.

### 5.4 Vertical Scroll (PageContainer)

- `scrollTarget` = desired Y position of the rail stack
- `scrollActual` = current eased Y position (updated every tick via easeStep)
- **Virtualization:** Only `RAIL_VISIBLE_ROWS (3)` + 1 buffer above + 1 below are mounted at a time (`:range` directive)
- Image prefetch: On scroll settle, warm HTTP cache for rails 2 steps ahead

### 5.5 Horizontal Scroll (ContentRail)

- **Window model:** WINDOW_BEFORE (1) + WINDOW_AFTER (5) = 7 cards mounted at most
- **Fixed focus slot:** Focused card's left edge always sits at `CONTENT_PADDING_X (64px)`; cards slide left/right under a static focus frame
- **Release coast:** If key releases < 0.4 cards from where hold-scroll stopped, coast one full card further (prevents partial-card stop)

---

## 6. Components In Detail

### Navbar (`src/components/Navbar.js`)

- Fixed at top, z=100, 1920×130px, always visible in `tab` chrome mode
- 5 tabs: Home, Movies, Shows, Sports, FPS (static list)
- Tab selection throttled at 250ms to prevent accidental multi-skip
- Animated underline bar slides between tabs (easeStep)
- Live FPS readout: fps, frame time, jank count, work ms — fed from `startFpsMeter`

### PageContainer (`src/components/PageContainer.js`)

- Wraps every tab page (inserted between page and rails)
- Mounts HeroCarousel if page data includes `heroSlides`
- Vertical rail stack with virtualized mounting
- Static **focus frame** (white border rectangle): positioned at the currently focused card's coordinates via `computed`; the frame never moves — cards slide under it

### ContentRail (`src/components/ContentRail.js`)

- Each horizontal row of cards
- Card slot: `cardW + 28px gap = 288px (portrait) or 488px (landscape)` per step
- `scrollTarget` jumps by one step per keypress; hold-advance continues every frame
- Cards outside the window are unmounted (no GPU texture held)

### PosterCard (`src/components/PosterCard.js`)

Two card orientations driven by `orientation` prop:
- **Portrait:** 260×310 (movie/show posters)
- **Landscape:** 460×260 (sports/trailers, 16:9)

Image loading is **gated on scroll settle** via `activeSrc` getter — images are not decoded during motion to avoid GPU texture upload overhead mid-animation. Card shows `#262626` placeholder until image arrives, then fades in.

### HeroCarousel (`src/components/HeroCarousel.js`)

- 880px tall, full stage width
- **Wrap-safe:** Slides laid out at 0, STAGE_W, 2×STAGE_W + clones at -STAGE_W and N×STAGE_W for seamless infinite wrap
- **Wrap snap:** On settle after wrap, invisible reposition back to base range (no visual discontinuity)
- **Chained input:** If next press arrives before settle, applies pending snap first then computes new target
- **Autoplay:** 10s interval when focused, reset on manual nav, stopped on unfocus

### HeroSlide (`src/components/HeroSlide.js`)

- Full-bleed BG image + vertical gradient (#0B0B0B bottom → transparent top) + text copy left-aligned
- Text: Subtitle (cyan), Title (64px white), Description (gray, 2 lines max)
- `keepAlive: true` on image texture — survives unmount/remount so tab-back doesn't re-fetch

### Meta (`src/pages/Meta.js`)

- Detail screen: poster left (520×780), metadata right (subtitle, title, description)
- Play button routes to `/player` with video URL param
- Back routes to previous tab via `router.back()`

### Player (`src/pages/Player.js`)

- Grabs `#player-video` from index.html; sets `src`, wires `timeupdate` / `loadedmetadata` / `play` / `pause`
- Blits overlay draws progress bar + time label (`m:ss` or `h:mm:ss`)
- Uses **integer intermediates** (`currentSeconds`, `durationSeconds`) so the time label only re-rasterizes when the second changes (not on every fractional timeupdate event)
- Autoplay policy: attempts with audio first; falls back to muted on `NotAllowedError`
- Chrome: canvas goes transparent so DOM `<video>` is visible behind it

### Fps (`src/pages/Fps.js`)

- Oversized FPS readout (480px blue text)
- Runs its own `startFpsMeter` instance (independent from Navbar's meter)
- Displays: fps, avgFrameMs, workMs, maxDt, jankCount

---

## 7. Data Layer

### contentFactory.js

```js
createRail({ id, title, genres, count, withProgress, orientation })
createHeroSlides({ id, slides })
```

- `rail.items` is a **lazy getter** — items are built on first access and cached
- Prevents ~85% of tab-boot work: only rails that actually mount materialize their items
- Each item gets a seeded Picsum URL based on `id + index` (same seed = same image every time)

### images.js

```js
buildPosterImages(prefix, count, w, h)   // default 260×300
buildHeroImages(prefix, count, w, h)     // default 1280×586
```

Generates `https://picsum.photos/seed/{prefix}-{category}-{index}/{w}/{h}` URLs. The `categories` pool is shuffled across a rail's items to vary image content.

### Tab Data Files

Each tab file exports a plain object with `{ heroSlides?, rails }`. Rails are defined with `createRail(...)` calls. No network requests at data-file import time — all image URLs are computed strings.

---

## 8. Constants

### layout.js

```js
STAGE_W = 1920, STAGE_H = 1080
NAVBAR_H = 130
CARD_W = 260, CARD_H = 310          // portrait
CARD_W_LAND = 460, CARD_H_LAND = 260 // landscape
RAIL_H = 410                         // portrait rail total height
CONTENT_PADDING_X = 64              // left edge where focus frame sits
cardDimsFor(orientation)            // returns { cardW, cardH, railH }
```

### theme.js

```js
COLORS.background    = '#0B0B0B'
COLORS.accent        = '#00B3FF'    // cyan — tabs, progress, buttons
COLORS.text          = '#FFFFFF'
COLORS.textSecondary = '#AAAAAA'
FONTS.body           = 'roboto'
```

---

## 9. Performance Optimizations

| Technique | Location | Effect |
|---|---|---|
| WebGL canvas rendering | Entire app | No DOM layout cost; GPU paints ~200 nodes in <1ms |
| maxFPS: 30 cap | index.js | Eliminates retained-mode pacing artifacts |
| Rail window virtualization | ContentRail | 7 of 20 cards mounted; rest have no GPU texture |
| Lazy rail items | contentFactory | 85% of tab-boot data deferred until scroll |
| Gated image decode | PosterCard.activeSrc | No texture upload during scroll motion |
| Viewport culling | index.js (viewportMargin:100) | Nodes >100px outside view skip GPU draw call |
| Exponential easing | easeStep | Frame-rate-independent; no discontinuity on re-target |
| Single RAF loop | rafLoop.js | All axes update in same frame (no micro-tears) |
| Hold-scroll (not OS repeat) | index.js + ContentRail | Consistent scroll speed regardless of OS settings |
| Sticky textures | HeroSlide (keepAlive) | Tab-back reuses cached hero textures |
| HTTP cache prefetch | prefetch.js | Adjacent rails pre-warm during idle |
| Integer time intermediates | Player.js | Progress label re-rasterizes at most once per second |
| Static focus frame | PageContainer | Frame never repositions; cards move under it |
| VRAM pressure controls | index.js (gpuMemory) | Evict textures before OOM on low-memory TVs |

---

## 10. FPS Metering (`src/helpers/fps.js`)

```js
const stop = startFpsMeter(({ fps, avgFrameMs, workMs, maxDt, jankCount, renderer, capHz }) => { ... })
```

- **fps:** Calculated from average frame time over a ~1s window
- **avgFrameMs:** Mean frame duration in that window
- **workMs:** Main-thread busy time per frame — measured via MessageChannel post-task probe (dispatches as macrotask after frame's script+layout+paint, so the gap estimates Blits render overhead)
- **maxDt:** Worst single frame in the window
- **jankCount:** Frames > 1.5× vsync threshold (missed at least one screen refresh)
- **capHz:** Measured refresh rate (10th-percentile of rAF intervals)
- **renderer:** Detected backend (`GL2`, `GL1`, `2D`)

Work-ms sampling runs every 4th frame to reduce its own measurement overhead.

---

## 11. Image Prefetch (`src/helpers/prefetch.js`)

```js
prefetchImages(urls)  // warm HTTP cache during idle time
```

- Uses `requestIdleCallback` to avoid interrupting animation frames
- Deduped by URL (module-level Set — never fetches the same URL twice)
- Drains in batches across multiple idle callbacks (respects idle budget)
- Falls back to `setTimeout` + synthetic deadline on browsers without rIC
- Called by PageContainer on scroll settle for the two rails ahead of view

---

## 12. Build & Dev

```bash
npm run dev          # Vite dev server (host: true, port 5173)
npm run build        # Production bundle → dist/
npm run preview      # Serve dist/ locally
npm run lint         # ESLint src/**/*.js
npm run lint:fix     # Auto-fix ESLint issues
```

**Vite plugins (vite.config.js):**
- `injectDevConfig()` — Blits dev mode injection
- `blitsFileConverter()` — Compile `.blits` templates
- `reactivityGuard()` — Validate reactive binding patterns
- `preCompiler()` — Pre-compilation optimization

**MSDF fonts:** The `@lightningjs/msdf-generator` plugin is **intentionally omitted** from vite.config.js — pre-generated Roboto assets are committed to `static/fonts/` to avoid a GLIBC 2.38 dependency that breaks Vercel CI. To regenerate: re-add the plugin locally, run dev, copy output from `node_modules/.tmp-msdf-fonts-v2/`, commit, remove plugin.

---

## 13. index.html Structure

```html
<video id="player-video" playsinline></video>  <!-- z-index: 0, hidden until Player -->
<div id="app"></div>                           <!-- z-index: 1, Blits canvas mounts here -->
<script type="module" src="/src/index.js"></script>
```

In `player` chrome mode, App.js sets canvas `color` to `rgba(0,0,0,0)` so the DOM `<video>` behind it becomes visible. When playback ends or user presses Back, canvas goes opaque again.

---

## 14. Key Architectural Decisions

**1. Fixed focus slot**
Cards slide left/right under a focus frame that never moves. This removes per-keypress frame repositioning from the critical path.

**2. Separated scroll axes**
Vertical (PageContainer) and horizontal (ContentRail) have independent easing loops registered to the same global RAF tick. They share a frame but don't share state — each axis has its own `tau`, `target`, and `actual`.

**3. Hold-scroll over OS auto-repeat**
OS auto-repeat has unpredictable timing and repeat rate. The app suppresses it and drives its own per-frame advance. Result: identical scroll behavior across every TV platform.

**4. Chrome modes via events**
`App.js` manages the navbar and background alpha; pages just emit `chrome:set`. No page needs to know about shell layout.

**5. keepAlive on tabs, not on drills**
Tab components survive drill-down so Back restores scroll position. Meta/Player are stateless drill screens — fresh mount is cheaper than persisting and resetting them.

**6. No MSDF at runtime**
Font atlas pre-generated and committed. Avoids build environment incompatibilities and eliminates ~200ms font bake from app boot.

**7. Lazy data, lazy images**
Data objects exist at module scope but items build only on first `.items` access. Images decode only after scroll settles. These two defers together keep tab-switch latency under 16ms.
