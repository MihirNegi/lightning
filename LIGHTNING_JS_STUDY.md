# Lightning JS Reference Repo — Study Report

Source: `C:\repositories\lightning-js`
Purpose: Reference notes for implementing similar patterns in `com.domain.app.lightDemo`.

---

## 1. Project Overview

A **JioTV+-style OTT streaming app** demonstrating a premium TV/set-top box interface. It's a reference implementation of a remote-controlled streaming media UI with categories (Home, Movies, Shows, Sports), hero carousel banners, and horizontally-scrolling content rails.

**Features demonstrated:**
- Blits (Lightning 3's component framework) component patterns for TV-optimized interfaces
- Full remote navigation system (D-pad + Enter)
- Focus management (one component owns focus at a time)
- Smooth animations, scroll behavior, state preservation across page navigation
- Auto-generated mock content (Lorem Picsum images, hashed titles) — no backend

---

## 2. Tech Stack & Tooling

**Runtime & Framework:**
- **Lightning SDK**: `@lightningjs/blits` v2.7.0 (Lightning 3 component framework — NOT the older `@lightningjs/sdk` v5 our current project uses)
- **Build Tool**: Vite 8.1.4 with Blits Vite plugins (NOT `lng` CLI)
- **JavaScript**: ES modules (`"type": "module"`), no TypeScript
- **Fonts**: MSDF (multi-channel signed distance field) for crisp rendering at any scale + web fonts

**Dev Dependencies:**
- ESLint 9.11.1 + `@eslint/js` (flat config style)
- Prettier 3.3.3 (single quotes, 100-char lines, no semicolons)
- Husky 9.1.6 + lint-staged 15.2.10 (pre-commit hooks)
- `@lightningjs/msdf-generator` for font compilation

**Scripts:**
- `npm run dev` — Vite dev server with hot reload
- `npm run build` — Production minified build to `dist/`
- `npm run lint` / `npm run lint:fix`

**App Config (`src/index.js`):**
- Resolution: **1920×1080**, letterboxed
- Canvas color: `#0B0B0B`
- Fonts: Lato (body), Raleway (headings), OpenSans (fallback)
- `viewportMargin: 300` — off-screen buffer for lazy rendering
- Mouse enabled (dev convenience)

> ⚠️ **Important stack mismatch**: This reference uses **Blits (Lightning 3)** while our current project uses **`@lightningjs/sdk` v5 (Lightning 2)**. Patterns and mental models transfer, but exact syntax (templates, focus, router) is different. We may want to decide whether to migrate our project to Blits before copying code verbatim.

---

## 3. Directory Structure

```
src/
  index.js                     Entry point: Blits.Launch(), font setup
  App.js                       Root: RouterView, Navbar, LoadingScreen
  pages/
    Home.js / Movies.js / Shows.js / Sports.js   Thin wrappers around PageContainer
  components/
    Navbar.js                  Top tab bar
    PageContainer.js           Generic page layout: hero + rails stack
    HeroCarousel.js            Auto-playing banner carousel
    HeroSlide.js               Single hero slide
    ContentRail.js             Horizontal scrolling row of cards
    PosterCard.js              Single poster (image, title, genre, progress)
    FocusBorder.js             Focus indicator (glow + border)
    SkeletonCard.js            Placeholder while images load
    LoadingScreen.js           Boot splash
    Loader.js                  Generic loading animation
    PerfHud.js                 Performance debug overlay
  constants/
    theme.js                   Colors, fonts
    layout.js                  All pixel dimensions
  helpers/
    animations.js              DURATION, EASING, transition() helper
    scroll.js                  getPageScrollOffset(), getRailScrollOffset()
    focusSound.js              Audio hook placeholders
  data/
    contentFactory.js          createRail(), createHeroSlides()
    images.js                  Lorem Picsum URL generation
    home.js / movies.js / shows.js / sports.js

public/
  fonts/                       TTF files compiled to MSDF
  assets/                      SVG favicon
```

---

## 4. Application Architecture

### Entry Point (`src/index.js`)
- Calls `Blits.Launch(App, 'app', {...config})` with screen dimensions, font definitions, theme colors
- Sets viewport margin for lazy rendering

### Root App (`src/App.js`)
- Uses Blits' built-in `RouterView`
- Defines 4 routes: `/`, `/movies`, `/shows`, `/sports`
- **Route options (`TAB_ROUTE_OPTIONS`):**
  - `passFocus: false` — pages don't steal focus on route change
  - `inHistory: false` — no history stack
  - `keepAlive: true` — page state preserved when switching away
  - `reuseComponent: false` — fresh component instance each navigation
- Shows `LoadingScreen` for 600ms on boot, then focuses `Navbar`
- Listens for `'nav:focus-navbar'` event

### Focus Management (the interesting bit)

Because `Navbar` and page content are **siblings** (not parent/child), they can't call `.$focus()` on each other directly. Instead, event-based handoff:

1. **Navbar has focus** initially → Left/Right cycles tabs, Down/Enter emits `'nav:focus-content'` and blurs itself.
2. **Page content has focus** → Up/Down moves between vertical sections (hero + rails); at the top-most section, Up emits `'nav:focus-navbar'` to restore Navbar.
3. **Each `ContentRail`** remembers its selected card and scroll position because the component instance stays alive (`keepAlive: true`).

### Pages
Each page is a thin wrapper:
```js
<PageContainer :hero="$hero" :rails="$rails" />
```
All layout lives in `PageContainer`.

### Data flow
Static/generated at import time — no API calls. Each page imports a data file exporting `{ hero, rails }`, both created by `createRail()` and `createHeroSlides()`.

---

## 5. Reusable Components

| Component | Purpose | Focus Behavior |
|---|---|---|
| `Navbar` | Top tab bar | Owns focus; Left/Right cycle tabs; Down/Enter hands off to page |
| `PageContainer` | Page layout template | Owns focus for pages; Up/Down move between sections |
| `HeroCarousel` | Auto-playing hero banner | Owns focus; Left/Right advance manually |
| `HeroSlide` | Single hero banner | Read-only, parent controls active state |
| `ContentRail` | Horizontal scrolling row | Owns focus for its row; remembers selection |
| `PosterCard` | Single poster | Read-only; parent tells it when focused |
| `FocusBorder` | Focus indicator overlay | Decorative; fades based on `active` prop |
| `SkeletonCard` | Loading placeholder | Shown while poster image loads |
| `LoadingScreen` | Boot splash | Conditional visibility |

### Focus Patterns
1. **Component-owns-focus** — Only the leaf component handling keys has real focus.
2. **Parent→child handoff** — `parent.$select('railRef').$focus()`
3. **Sibling→sibling via events** — `this.$emit('nav:focus-content')` / `this.$listen('nav:focus-navbar')`
4. **State preservation** — `keepAlive: true` keeps `selectedIndex`/`scrollOffset` alive

### Animation Pattern
Shared `transition()` helper:
```js
transition(targetValue, { duration: DURATION.base, easing: EASING.smooth })
```
Durations: 200ms (fast) → 800ms (hero).

### Theming
All colors, fonts, pixel dimensions live in `constants/theme.js` and `constants/layout.js`.

> ⚠️ **Blits template quirk**: `template` strings are scanned at build time as plain text — they **cannot contain JS template-literal interpolation** (`` `w="${value}"` ``). Templates hardcode pixel values with inline comments pointing back to the constant file.

---

## 6. Notable Techniques

### Image Loading & Lazy Rendering
- External images from Lorem Picsum, deterministic URLs seeded by rail/page ID (so images don't reshuffle)
- Blits auto-clips off-screen components
- `viewportMargin: 300` — loads content 300px before entering view
- `PosterCard` shows `SkeletonCard` until `@loaded` event fires
- `@error` handler keeps skeleton visible instead of broken image

### Scroll Behavior
- No real scrolling — everything is `y` position transitions on parent containers
- `getPageScrollOffset()` — positions focused rail's title just below navbar (with 24px gap)
- `getRailScrollOffset()` — pins focused card to the left edge: `selectedIndex * (cardWidth + gap)`
- Even the last card scrolls to the left edge (leaves blank space on right)

### Animations & Easing
- Focus scale: 1.0 → 1.12 with bounce (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
- Smooth scroll: `cubic-bezier(0.4, 0, 0.2, 1)`
- Hero carousel: fade + subtle slide-in (800ms for premium feel)
- Navbar tab: underline grows/shrinks, text color fades

### Audio Hooks
- `focusSound.js` exports `playFocusSound()` / `playSelectSound()` — currently no-op stubs
- Easy to wire to platform audio on real TV hardware

### Content Generation
- `contentFactory.js` uses stable hashing to seed titles (same rail → same titles)
- Genres cycle round-robin
- Progress bars only on "Continue Watching" rail

---

## 7. Files Worth Reading in Detail

Priority order for when we start implementing:

1. **`src/App.js`** (~77 lines) — Route setup, router options, focus listener, boot loading. Copy this shape.
2. **`src/components/PageContainer.js`** (~115 lines) — Generic page layout template, vertical scroll math, focus transitions. The single most reusable piece.
3. **`src/components/Navbar.js`** (~126 lines) — Tab navigation, event emission for focus handoff, route syncing.
4. **`src/components/ContentRail.js`** (~113 lines) — Horizontal card scrolling, focus memory, scroll math.
5. **`src/helpers/scroll.js`** (~34 lines) — Both scroll offset functions. Essential math.
6. **`src/helpers/animations.js`** (~33 lines) — Shared animation durations and easings.
7. **`src/data/contentFactory.js`** (~113 lines) — Mock data generation via stable hashing.
8. **`src/components/PosterCard.js`** (~110 lines) — Prop-driven card, image loading, skeleton, focus scale.
9. **`src/constants/layout.js`** (~22 lines) — All pixel dimensions. Mirror this in our project.
10. **`src/index.js`** (~30 lines) — `Blits.Launch()` config, font setup, viewport.

---

## Key Takeaways for `com.domain.app.lightDemo`

- **Centralize constants** — one source of truth for colors, fonts, sizes, timings.
- **Compartmentalize focus** — one component owns input at a time; hand off via events for siblings, `$focus()` for children.
- **Preserve state** — use `keepAlive: true` so users don't lose scroll position when switching tabs.
- **Animate intentionally** — shared durations and easings give a premium, consistent feel.
- **Lazy load everything** — set a viewport margin, seed deterministic image URLs.
- **Build reusable templates** — `PageContainer` is the entire page layout in ~30 lines.

---

## Decisions Made

1. **Framework** — **Blits (Lightning 3)**. Target is latest-gen LG / Samsung / Vidaa only.
2. **Build tool** — **Vite** (comes with Blits).
3. **Data source** — Mock data for now. Add a services layer later when a real API is available.
4. **Target platforms** — Latest-gen smart TVs (LG WebOS 2020+, Samsung Tizen 2020+, Vidaa recent gen).

---

## 8. Why the Reference Runs Slow on Vidaa (Analysis)

The reference is fast on PC and painful on Vidaa. Here's why, ordered by impact.

### Top Drawbacks

1. **676 posters on the Home page alone** — 26 rails × 26 items ([`data/home.js`](../lightning-js/src/data/home.js), [`data/contentFactory.js`](../lightning-js/src/data/contentFactory.js) with default `count = 26`). Each PosterCard renders ~9 nested elements, so Home alone has ~6,000 render nodes.

2. **All images fetched from external Lorem Picsum URLs** — [`data/images.js`](../lightning-js/src/data/images.js). 676 HTTPS requests to a single origin, slow TV WiFi, and no persistent HTTP cache. This alone probably accounts for 60–80% of the slowness.

3. **`keepAlive: true` on every route** — after visiting all 4 tabs, ~2,600+ image references live in memory. TVs OOM-kill apps when this happens.

4. **`viewportMargin: 300`** — pre-loads 300px of off-screen content on every side. Delays first paint.

5. **Heavy per-card shader effects** — `shadow="{blur: 24, ...}"`, `rounded="12"`, `fit="cover"` on every card. Fine on desktop GPU, expensive on TV.

6. **MSDF fonts × text-heavy layout** — every glyph is a fragment shader. Home has ~1,350 text nodes.

7. **`enableMouse: true`** — unnecessary event listeners on a TV.

8. **`debugLevel: 1`** — extra framework logging.

9. **Hero carousel auto-play** — constantly cross-fades 1920×880 images.

10. **Focus scale + bounce easing** — smooth on PC, jittery on weak GPUs.

### Guidelines for Our Own App (to avoid this)

- **Bundle images or use a CDN with a manifest.** No external picsum-style URLs.
- **Fewer rails per page.** Start with 6–8, load more on scroll.
- **Fewer items per rail.** 15–20 max, page in more when the user scrolls right.
- **Evict images on distant tabs.** Either drop `keepAlive` for far-away pages, or wire up a manual eviction.
- **Tighter viewport margin.** 100–150px.
- **Drop the blurred shadow.** Bake shadow into the poster PNG or use a static soft glow.
- **`enableMouse: false`** for production TV builds.
- **`debugLevel: 0`** in production.
- **Hero auto-play interval ≥ 10s**, or skip auto-play entirely.
- **Simpler focus animation** — opacity/border-color instead of scale on weak devices.
