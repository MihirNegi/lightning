# Code Walkthrough — `com.domain.app.lightDemo`

A file-by-file, function-by-function guide to how this Blits (Lightning 3) TV app is put together, including the boot flow, focus system, and data pipeline.

---

## Table of Contents

1. [Big Picture — What This App Is](#1-big-picture)
2. [Boot Flow — What Happens When You Load the Page](#2-boot-flow)
3. [Focus System — How Keyboard Navigation Works](#3-focus-system)
4. [File-by-File Walkthrough](#4-file-by-file-walkthrough)
5. [Data Flow — How a Poster Gets on Screen](#5-data-flow)
6. [Key Concepts / Gotchas](#6-key-concepts--gotchas)

---

## 1. Big Picture

We're building an OTT-style streaming TV app inspired by JioTV+ / Netflix / Prime, targeting **latest-generation smart TVs** (LG WebOS, Samsung Tizen, Vidaa).

The app is structured as:

```
┌──────────────────────────────────────────────────┐
│                      Navbar                      │  ← logo + 4 tabs, focus-owner initially
├──────────────────────────────────────────────────┤
│                                                  │
│                  HeroCarousel                    │  ← wide banner at top of every page
│                (image + text)                    │
│                                                  │
├──────────────────────────────────────────────────┤
│  Trending Now                                    │
│  [card][card][card][card][card][card]…           │  ← ContentRail (horizontal scroll)
│                                                  │
│  Popular Right Now                               │
│  [card][card][card][card][card][card]…           │
│                                                  │
│  Continue Watching                               │
│  [card][card][card][card][card][card]…           │  ← cards can show progress bar
│  ...more rails...                                │
└──────────────────────────────────────────────────┘
```

Four routes: `/` (Home), `/movies`, `/shows`, `/sports`. Each is a page that reuses the same **`PageContainer`** layout — differing only in the hero + rails data it feeds in.

---

## 2. Boot Flow

What happens, in order, when the browser loads `http://localhost:5174/`:

1. **`index.html`** loads. It contains an empty `<div id="app">` and a `<script type="module" src="/src/index.js">` tag.
2. **Vite** intercepts the request for `/src/index.js`, runs it through the Blits Vite plugin (which pre-compiles Blits template strings into optimised code), and serves the transformed JavaScript.
3. **`src/index.js`** runs. It calls `Blits.Launch(App, 'app', {...config})`, which:
    - Creates a Lightning 3 WebGL 2 canvas and mounts it inside `<div id="app">`.
    - Reads the config: `w:1920`, `h:1080`, `debugLevel:0`, `enableMouse:false`, `viewportMargin:150`, `canvasColor:'#0B0B0B'`, and one web font (`roboto`).
    - Instantiates the **`App`** component and starts the render loop.
4. **`src/App.js`** runs its `hooks.ready()`:
    - Registers a global listener for `'nav:focus-navbar'` events (used later by pages to hand focus back to the Navbar).
    - Calls `focusNavbar()`, which does `this.$select('navbar').$focus()` — giving keyboard focus to the Navbar.
5. **Navbar's `hooks.ready()`** runs `syncFocusIndexWithRoute()` — reads the current route (`/`) and sets `focusIndex` to `0` so the "Home" tab is highlighted.
6. **Router** sees the URL is `/` and mounts the **`Home`** page component inside the `<RouterView>`. Home renders `<PageContainer :hero=... :rails=... />`.
7. **`PageContainer`** renders **`<HeroCarousel>`** at `y=0` and each **`<ContentRail>`** below it (at `y = 880 + index * 506`).
8. Each **`<ContentRail>`** iterates its items and renders a **`<PosterCard>`** for each. Each `<PosterCard>` starts fetching its picsum image asynchronously.
9. Screen paints. You see: navbar at top with "Home" highlighted, hero image behind blurb text, rails filling in as posters load.

---

## 3. Focus System

Only **one component owns keyboard input at any time**. Whoever has focus receives `left/right/up/down/enter/back` events. The whole navigation is a chain of focus handoffs.

### The three main focus owners

| Owner | Handles | Passes focus… |
|---|---|---|
| **Navbar** | Left/Right (cycle tabs, switch route), Down/Enter (enter page) | Down/Enter → emits `'nav:focus-content'` |
| **PageContainer** | Up/Down (move between sections), Back | Down/Up → calls `.$focus()` on the child rail/hero. Up at top → emits `'nav:focus-navbar'` |
| **ContentRail** | Left/Right (move card cursor), Enter (open detail — TODO) | Never — it's a leaf owner |
| **HeroCarousel** | (currently a stub — no input) | — |

### How handoff works

- **Parent → Child** — `parent.$select('refName').$focus()`. Direct API call. Used by PageContainer to focus its hero or one of its rails.
- **Sibling → Sibling via events** — `this.$emit('some-event')`, other side listens with `this.$listen('some-event', callback)`. Used because Navbar and PageContainer are siblings under App, not parent/child — they can't reach each other directly. Two events:
  - `'nav:focus-content'` — Navbar → PageContainer (user pressed Down/Enter on Navbar)
  - `'nav:focus-navbar'` — PageContainer → App → Navbar (user pressed Up at top of page, or Back)

### Full flow example: user browses home page

```
Boot        Navbar (Home tab highlighted)
  ↓ Right   Navbar (Movies tab highlighted, route changes to /movies)
  ↓ Left    Navbar (Home tab highlighted again)
  ↓ Down    Navbar emits 'nav:focus-content'
            → PageContainer.focusCurrentSection()
            → sectionIndex=0 → focuses hero (visible tint change)
  ↓ Down    PageContainer.sectionIndex=1 → focuses rail 0 ("Trending Now")
            → page scrolls up so rail 0 sits below navbar
  ↓ Right   ContentRail selectedIndex=1 → second card focused
            → rail track scrolls left
  ↓ Down    PageContainer.sectionIndex=2 → focuses rail 1
  ↓ Up      PageContainer.sectionIndex=1 → focuses rail 0 (remembers previous card!)
  ↓ Up      PageContainer.sectionIndex=0 → focuses hero
  ↓ Up      PageContainer at top → emits 'nav:focus-navbar' → Navbar focused again
```

**State preservation:** Because pages have `keepAlive: true`, ContentRail and PageContainer instances stay alive when the user leaves and comes back. `selectedIndex`, `scrollOffset`, and `sectionIndex` remain — the user returns exactly where they left off.

---

## 4. File-by-File Walkthrough

### `index.html`
The Vite entry HTML. Nothing app-specific — just an empty `#app` div where Blits injects its canvas, plus some CSS to remove browser margins.

### `vite.config.js`
- `publicDir: 'static'` — tells Vite to serve our `static/` folder as if it were `public/`. This is why `fonts/Roboto-Regular.ttf` in `static/` is reachable at `/fonts/Roboto-Regular.ttf`.
- `plugins: [...blitsVitePlugins]` — activates the Blits pre-compiler which parses `template: \`...\`` strings at build time.

### `src/index.js` — App bootstrap
Calls `Blits.Launch(App, 'app', {config})`. Key config values:
- **`w: 1920, h: 1080`** — design resolution. Blits scales this to actual viewport.
- **`debugLevel: 0`** — no framework logging (perf; step from anti-slow-TV rules).
- **`enableMouse: false`** — mouse listeners off (perf; useless on TV anyway).
- **`viewportMargin: 150`** — Blits pre-renders content up to 150px outside the visible viewport (originally 300 in reference — we tightened it).
- **`canvasColor: '#0B0B0B'`** — background clear color (matches app theme).
- **`fonts: [{family:'roboto', type:'web', file:'fonts/Roboto-Regular.ttf'}]`** — a single web font, loaded from `/fonts/Roboto-Regular.ttf` (mapped from `static/fonts/`).

### `src/App.js` — Root component + router
Uses `Blits.Application({...})` (which is `Blits.Component` plus router support).

**`components: { Navbar }`** — declares Navbar as a child component.

**`template`** — an outer 1920×1080 dark rectangle containing:
- `<RouterView ref="router" ...>` — Blits' built-in router-outlet. Whichever page matches the URL renders here.
- `<Navbar ref="navbar" />` — sits on top (z=100 in the Navbar itself), floats above the router content.

**`routes`** — array of `{path, component, options}`. All 4 tabs share the same `TAB_ROUTE_OPTIONS`:
- `passFocus: false` — page component doesn't auto-focus on mount. Navbar keeps focus.
- `inHistory: false` — no browser history stack. Prevents Back-button confusion.
- `keepAlive: true` — component instance stays in memory when the user switches tabs. Preserves scroll positions and selected cards.
- `reuseComponent: false` — do not reuse the same instance if the same route is entered again.

**`hooks.ready()`** — runs once after the app first mounts. Registers the `'nav:focus-navbar'` listener and calls `focusNavbar()` to give initial focus to the Navbar.

**`methods.focusNavbar()`** — looks up the navbar by its `ref` and calls `.$focus()` on it. Wrapped in a null-check so it doesn't crash if the navbar isn't ready.

### `src/constants/theme.js` — Colours + fonts
Two exports:
- **`COLORS`** — palette (`background, surface, card, accent, accentSoft, text, textSecondary, textMuted, navGradientTop`).
- **`FONTS`** — font family name lookup (`body`, `heading` — both `'roboto'` right now).

⚠️ These constants can only be used in **JavaScript code** (methods, computed, config). They **cannot** be interpolated into `template` strings because the Blits pre-compiler parses templates as literal text at build time — `${COLORS.background}` would fail. Templates must hardcode the same values with a comment linking back to this file.

### `src/constants/layout.js` — Pixel dimensions
Single source of truth for every size:
- **`STAGE_W = 1920, STAGE_H = 1080`** — design resolution.
- **`NAVBAR_HEIGHT = 130`** — top nav bar height.
- **`CONTENT_PADDING_X = 64`** — left/right padding for rails and hero text.
- **`CARD_W = 260, CARD_H = 390, CARD_GAP = 28`** — poster dimensions.
- **`RAIL_TITLE_HEIGHT = 76, RAIL_GAP = 40, RAIL_HEIGHT = 506`** — rail heights.
- **`HERO_HEIGHT = 880`** — hero banner height.
- **`RAIL_VISIBLE_WIDTH = 1792`** — width available for a rail's cards (stage minus 2× padding).

Same interpolation warning applies as with `theme.js` — templates hardcode these.

### `src/helpers/animations.js` — Shared animation config
- **`DURATION = { fast:200, base:300, slow:500, hero:800 }`** — millisecond durations for transitions. Everything animates in this rhythm so the UI feels consistent.
- **`EASING = { smooth:'cubic-bezier(0.4,0,0.2,1)', bounce:'cubic-bezier(0.34,1.56,0.64,1)' }`** — two curves. `smooth` for scroll/fade/nav. `bounce` reserved for focus scale (we removed scale, but the curve is still exported if needed).
- **`transition(value, options)`** — helper that returns a Blits transition config object `{value, duration, easing, delay}` with sensible defaults. Used by PageContainer and ContentRail to build their scroll transitions.

### `src/helpers/scroll.js` — Scroll math
Two pure functions, no side effects, easy to test.

- **`getRailScrollOffset(index, cardWidth, gap)`** — horizontal scroll offset for a rail so the focused card sits at the leftmost slot. `Math.max(index * (cardWidth + gap), 0)`. Even for the last card in a rail, this pins it to the left edge (blank space to the right is fine).
- **`getPageScrollOffset(sectionIndex, heroHeight, railHeight, navbarHeight)`** — vertical scroll offset so the focused rail's title sits just under the navbar. If `sectionIndex === 0` (hero), returns 0 (no scroll). Otherwise: `heroHeight + (sectionIndex - 1) * railHeight - navbarHeight - NAVBAR_GAP`. `NAVBAR_GAP = 24` is a small breathing space so the rail title doesn't touch the navbar.

### `src/components/Navbar.js` — Top navigation bar

**`TABS`** — module-level array of `{label, path}` objects: the four tabs.

**`template`** —
- Outer 1920×130 element with a dark background (`rgba(11,11,11,0.95)`), z=100 so it floats above the page.
- **"lightDemo" logo** at `x=64, y=46` — blue accent color, larger size.
- **`<Element :for="(tab, index) in $tabs" ...>`** — loops over the tabs, laying each one out at `x = 260 + index * 140` (logo width offset + spacing).
  - Inside the loop: a `<Text>` showing the tab label. Its `color` is a conditional expression: white if this is the active tab, gray otherwise.
  - Below the text, a small **underline element** — a 4px tall blue rectangle. Its `w` (width) has a `.transition` attribute: it animates from `0 → 70` when this tab becomes active, and `70 → 0` when it becomes inactive. That's the sliding-underline effect.

**`state`** — just `focusIndex` (which tab is highlighted).

**`hooks.ready()` and `hooks.focus()`** — both call `syncFocusIndexWithRoute()`. This makes sure the highlight matches whatever route is currently active (in case another component navigated us programmatically, e.g. deep link).

**`input.left()`** — decrement `focusIndex` (stops at 0), then call `selectTab()`.
**`input.right()`** — increment `focusIndex` (stops at last tab), then call `selectTab()`.
**`input.down()` / `input.enter()`** — both emit `'nav:focus-content'`. This is the event PageContainer listens for.

**`methods.selectTab(index)`** — updates `focusIndex` and calls `this.$router.to(path)` to navigate. The URL changes, the router mounts the matching page.

**`methods.syncFocusIndexWithRoute()`** — reads `this.$router.currentRoute.path` and finds the tab with a matching path. If found, sets `focusIndex` to that tab's position.

### `src/components/PageContainer.js` — Shared page layout

**Purpose:** every page uses this same layout — hero on top, N rails below — so all logic (Up/Down navigation, scroll, focus handoff) lives here in one place.

**`components: { HeroCarousel, ContentRail }`** — declares the children we'll instantiate.

**`template`** —
- A single outer `<Element>` with `:y.transition="$scrollTransition"` — this whole element slides up and down to bring the current section into view. `$scrollTransition` is a computed value below.
- Inside: `<HeroCarousel ref="hero" :slides="$hero" />` at implicit `y=0`.
- Then `<ContentRail :for="(rail, index) in $rails" ...>` — loops over the rails, rendering each at `y = 880 + index * 506` (below the hero, stacked with 506px per rail).
  - Each rail gets `ref="'rail' + $index"` — so we can find them later by dynamic name (`rail0`, `rail1`, `rail2`, …).

**`props: { hero: [], rails: [] }`** — data flows in from the page component.

**`state.sectionIndex`** — which vertical section has focus. `0` = hero. `1`, `2`, `3`, … = rail 0, rail 1, rail 2, ….

**`computed.scrollOffset`** — calls `getPageScrollOffset(sectionIndex, HERO_HEIGHT, RAIL_HEIGHT, NAVBAR_HEIGHT)`. Recalculated any time `sectionIndex` changes.

**`computed.scrollTransition`** — builds the transition config for the outer element's `y` attribute using `transition(-scrollOffset, {duration: 500, easing: 'smooth'})`. The negative sign because moving the element UP (into negative y) reveals content below.

**`hooks.init()`** — registers `this.$listen('nav:focus-content', () => this.focusCurrentSection())`. This is the sibling handoff mechanism.

**`input.down()`** — if we're not already at the last rail, increment `sectionIndex` and focus the next section.
**`input.up()`** — if we're at the top (hero), emit `'nav:focus-navbar'` to hand focus back. Otherwise decrement `sectionIndex` and focus the previous section.
**`input.back()`** — always hand focus back to the Navbar.

**`methods.focusCurrentSection()`** — computes the ref name (`'hero'` or `'railN'`) and calls `.$focus()` on the matching child. Silent no-op if the child isn't found.

### `src/components/HeroCarousel.js` — Hero banner (currently stub)

Currently a **stub**. Shows only the first slide's image + subtitle + title + description. Real carousel with auto-play + slide transitions comes in step 6.

**`template`** —
- Base 1920×880 element with `:src="$firstImage"` (no color → defaults to white → no tinting).
- **Overlay** — a second 1920×880 element with a semi-transparent color. This darkens the image so the text stays readable. On focus, the overlay tint shifts to a subtle blue (`rgba(0,179,255,0.12)`); when unfocused, it's black at 35% (`rgba(0,0,0,0.35)`).
- Three text elements stacked on the left: subtitle (accent blue), title (large white), description (smaller light gray, up to 2 lines).

**`props.slides`** — the array of slide objects.

**`computed.firstSlide, firstImage, firstTitle, firstSubtitle, firstDescription`** — pull data off `slides[0]` with fallbacks so nothing crashes if slides are empty.

### `src/components/ContentRail.js` — Horizontal card row

**`template`** —
- Outer element `h=466` (title strip + card area).
- **Rail title** — a `<Text>` at the top with `:color="$$hasFocus ? '#FFFFFF' : '#AAAAAA'"`. `$$hasFocus` is a special Blits binding that resolves to `true` when this component currently has keyboard focus. So the title brightens when you're inside this rail.
- **`clipping="true"` inner wrapper** — a 1792×414 window with clipping enabled. Anything scrolled outside is cut off (essential so cards to the left of index 0 don't appear).
- **Track** — inner element with `:x.transition="$trackTransition"`. This is the scrolling row. It moves horizontally to bring the selected card to the left edge.
- Inside the track: `<PosterCard :for="(item, index) in $items" ...>`. Each card is placed at `:x="$index * 288"` (card width 260 + gap 28 = 288). The `:focused` prop is `$$hasFocus && $index === $selectedIndex` — only the currently-selected card in the currently-focused rail is truly focused.

**`props: { title, items }`** — passed in from PageContainer.

**`state`** — `selectedIndex` (which card cursor is on) and `scrollOffset` (how far the track has scrolled).

**`computed.trackTransition`** — builds the transition for the track's `x`. Uses `-scrollOffset` because moving the track left reveals cards to the right.

**`input.left()`** — decrement `selectedIndex` (stops at 0), update scroll.
**`input.right()`** — increment (stops at last item), update scroll.
**`input.enter()`** — no-op for now. Later this will open a detail page / start playback.

**`methods.updateScroll()`** — recalculates `scrollOffset` via `getRailScrollOffset(selectedIndex, CARD_W, CARD_GAP)`.

### `src/components/PosterCard.js` — Single poster card

**Purpose:** render one item — image, title, genre, and (optionally) a progress bar. Fully prop-driven. The parent rail owns real focus and just tells the card via `:focused` whether it's selected.

**`template`** —
- Outer 260×390 element. Its `:zIndex` is 10 when focused, 1 otherwise — pushes the focused card above its neighbours so the white border can render on top without being clipped.
- **Image element** — 260×300, `:rounded="12"` (12px corner radius), `color="#FFFFFF"` (so it doesn't tint the image), `:src="$image"`, `fit="cover"`.
  - Inside the image, a **progress bar** (`:show="$hasProgress"`) — 6px tall element at y=294 (near the bottom of the image). A dark base bar, with a bright blue fill whose width is `260 * clamped_progress`.
- **Focus border overlay** — a second 260×300 rounded element with `:border="{width:3, color:'#FFFFFF'}"`. Its `:alpha.transition` animates from 0 to 1 when `focused` becomes true, over 200ms.
- **Title text** at y=314. Color changes: accent blue when focused, white otherwise.
- **Genre text** at y=348 in gray.

**`props: { title, genre, image, progress, focused }`** — everything the card needs.

**`computed.hasProgress`** — `typeof progress === 'number'`. Some rails pass no progress, some (Continue Watching) do.
**`computed.progressBarWidth`** — clamps progress between 0 and 1, then multiplies by card width 260. Returns an integer number of pixels for the progress fill.

**Perf choices vs the reference:**
- No blurred `shadow` — the reference had `shadow="{blur:24, spread:2, color:...}"` which is expensive on TV GPUs.
- No scale transition — the reference scaled cards 1.0 → 1.12 with bounce. Every scale is a texture re-composite.
- No SkeletonCard — reference had a placeholder box while loading. We just show the white background briefly.
- No outer soft glow — the reference had a translucent blue rectangle behind the border for a glow effect.

Net result: focus indication is just a **border fade in + title color change**. Cheap on GPU, still clearly visible to the user.

### `src/data/contentFactory.js` — Data builder

**`ADJECTIVES` / `NOUNS`** — small pools of poster-title words.

**`hashString(value)`** — turns a string into a small positive integer. Uses the classic `(hash * 31 + charCode) % 100000` recipe. Same input always gives same output — deterministic.

**`generateTitle(seed)`** — pulls one adjective and one noun using two different indexings of the seed. Always the same title for the same seed.

**`createRail({id, title, genres, count=15, withProgress=false})`** — builds a rail object:
- Calls `buildPosterImages(id, count)` to get an array of image URLs.
- Hashes the id to seed titles.
- Loops `count` times to build items: `{id, title, genre, image, progress?}`. Genre round-robins through the `genres` array. Progress is undefined unless `withProgress` is true, in which case it's a semi-random 0.15–0.85 value.
- Returns `{id, title, items}`.

**`createHeroSlides({id, slides})`** — attaches a background image to each provided slide. Returns an array of `{id, image, title, subtitle, description}`.

### `src/data/images.js` — Picsum URL builder

**`POSTER_CATEGORIES` / `HERO_CATEGORIES`** — string categories used as URL hints.

**`picsumUrl(seed, w, h)`** — returns `https://picsum.photos/seed/${seed}/${w}/${h}`. Picsum uses the seed to pick a deterministic image and serves an image resized to the requested dimensions.

**`buildPosterImages(prefix, count, w=260, h=300)`** — loops N times, cycles through `POSTER_CATEGORIES`, and calls `picsumUrl(\`${prefix}-${category}-${i}\`, w, h)`. Each URL is unique so images don't repeat across a page.

**`buildHeroImages(prefix, count, w=1920, h=880)`** — same idea for hero images.

⚠️ **Note:** we know picsum is bad for TV. It sends a 302 redirect that adds latency, and it queues badly on TV WiFi. This will need to be replaced with bundled images or a proper CDN before actual TV testing.

### `src/data/home.js` / `movies.js` / `shows.js` / `sports.js`

Each is nearly identical — differs only in title text and rail lineup:
1. Calls `createHeroSlides({id, slides})` with the page's hero copy.
2. Builds an array of 6 rails via `createRail({...})`. One rail per page has `withProgress: true` (e.g. Home's "Continue Watching").
3. Exports `{ hero, rails }`.

The page components import this default export and pass it to `PageContainer`.

### `src/pages/Home.js` / `Movies.js` / `Shows.js` / `Sports.js`

Each is a thin wrapper — 15 lines each:
- Imports `PageContainer` and the page's data file.
- Template is one line: `<PageContainer :hero="$hero" :rails="$rails" />`.
- Exposes `hero` and `rails` from data via `state()`.

Pages are intentionally boring — all the layout logic lives in `PageContainer`. If you want to add a new tab, you create one data file + one page file + one route entry in App.js.

---

## 5. Data Flow — How a Poster Gets on Screen

Trace of what happens for a single poster on Home:

1. **`src/data/home.js`** runs at import time. Calls `createRail({id:'home-trending', title:'Trending Now', genres:[...]})`.
2. **`createRail`** in `contentFactory.js` calls `buildPosterImages('home-trending', 15)`.
3. **`buildPosterImages`** builds 15 URLs like `https://picsum.photos/seed/home-trending-city-0/260/300`, `.../home-trending-architecture-1/260/300`, etc.
4. **`createRail`** loops 15 times, building item objects: `{id:'home-trending-0', title:'Silent Horizon', genre:'Action', image:'https://picsum...'}`. Returns `{id, title, items:[...15 items]}`.
5. `homeData.rails` becomes a length-6 array of these rail objects.
6. **`Home.js`** exposes this in its `state()`: `{ hero, rails }`.
7. **`<PageContainer :hero="$hero" :rails="$rails" />`** — the state passes down as props.
8. **`PageContainer`**'s template does `<ContentRail :for="(rail, index) in $rails" ...>`. For each rail, it renders a `<ContentRail>` with `:title="$rail.title" :items="$rail.items"`.
9. **`ContentRail`**'s template does `<PosterCard :for="(item, index) in $items" ...>`. For each item, `<PosterCard :image="$item.image" ...>` is instantiated.
10. **`PosterCard`**'s image element has `:src="$image"` — Blits sees the src prop change, its texture loader kicks off an `<img>` request to picsum.
11. Picsum returns a 302 redirect → browser follows it → CDN returns JPEG → browser decodes → Blits uploads decoded pixels to a WebGL texture → texture appears on screen inside the rounded rectangle.

**Repeat 90 times per page** (6 rails × 15 items). Every one of these requests is independent, capped at ~6 concurrent by Chrome's per-origin limit.

---

## 6. Key Concepts / Gotchas

### 6a. Template pixel values must be literals
Blits pre-compiles `template: \`…\`` strings at build time. JS interpolation like `w="${STAGE_W}"` breaks the compiler. Instead, hardcode `w="1920"` and leave a comment linking to the constant. This is why `App.js`'s template says `color="#0B0B0B"` and not `color="${COLORS.background}"`.

### 6b. `color` tints textures
On an element with `:src="..."`, the `color` attribute multiplies the image pixels. Setting `color="#1C1C1C"` makes every image render as dark gray × image = crushed dark. Always use `color="#FFFFFF"` (white — no tint) when you want the natural image colors. This is what caused the "black posters" bug earlier.

### 6c. `$$hasFocus` vs `$focused`
- `$$hasFocus` (with double dollar) is a **built-in Blits binding** — true when this component currently owns keyboard focus. Used inside a component's own template to change its own appearance.
- `$focused` (single dollar) is just a **prop or computed name** we happen to use for the same idea. In PosterCard, `focused` is a prop passed in by the parent rail: `:focused="$$hasFocus && $index === $selectedIndex"`. This is how a child that doesn't own focus itself knows visually whether it's "selected".

### 6d. Refs and dynamic ref names
`ref="hero"` gives that child a name. `this.$select('hero')` looks it up. Dynamic ref names use string concatenation: `:ref="'rail' + $index"` gives `rail0, rail1, rail2, …`, retrievable with `this.$select('rail0')`, etc.

### 6e. Blits transitions
Any attribute can have `.transition` appended: `:x.transition="{value:100, duration:300, easing:'...'}"`. Blits sees this and animates the value smoothly instead of jumping. This is how the horizontal rail scroll, the vertical page scroll, and the focus border fade all work.

### 6f. `keepAlive` and state preservation
By default, when a route changes, the old page's component instance is destroyed. That means `selectedIndex`, `scrollOffset`, etc. are all reset when the user comes back. `keepAlive: true` keeps the instance in memory. This is why our home page remembers "user was on rail 2, card 5" even after they visit /movies and come back.

### 6g. Anti-slow-TV rules we followed
| Rule | Where it's applied |
|---|---|
| Bundle images / no external URLs | ❌ **not yet** — using picsum. Must fix before TV. |
| Fewer rails (6-8) | ✅ 6 rails per page. |
| Fewer items per rail (15-20) | ✅ default `count=15` in `createRail`. |
| Tighter viewport margin | ✅ `viewportMargin: 150` (was 300 in reference). |
| No blurred shadows | ✅ removed from PosterCard. |
| No scale animation on cards | ✅ replaced with border fade + text color. |
| `enableMouse: false` | ✅ in `src/index.js`. |
| `debugLevel: 0` | ✅ in `src/index.js`. |

---

## 7. What's Not Built Yet

- **Real HeroCarousel** — auto-play, Left/Right nav, cross-fade between slides. (Step 6 in our plan.)
- **Detail page / playback** — Enter on a poster currently does nothing.
- **Bundled or CDN images** — will replace picsum before TV testing.
- **Real fonts** — currently only Roboto; the reference used Lato + Raleway.
- **Loading/error states** — no skeleton, no fallback UI if picsum fails.
- **PerfHud** — the reference had an on-screen FPS meter. Useful for TV testing later.
- **Focus sounds** — reference had hooks for `playFocusSound()` / `playSelectSound()`. Empty for us.
