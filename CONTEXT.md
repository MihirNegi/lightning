# CONTEXT.md — How This App Actually Paints Pixels

A plain-English guide to what happens between "the browser opens the page" and "you see a poster card on the screen". No jargon. Real examples.

Read this together with [CODE_WALKTHROUGH.md](CODE_WALKTHROUGH.md). That file explains **what the code does**. This file explains **how it ends up as pixels**.

---

## 1. What Even Is a Blits App?

A normal website uses HTML. You write `<div>`, `<img>`, `<button>`, and the browser paints them.

**This app does not use HTML for its UI.** It uses a single big `<canvas>` element, and paints EVERYTHING on it — every card, every image, every letter of text — using the GPU (WebGL 2).

Why? Because HTML is slow on a TV. Every `<div>` costs memory and repaint time. With 90 cards on a page, HTML crawls. A single canvas painted by the GPU stays fast even on cheap TVs.

If you open DevTools on this app, you will see almost no HTML — just:

```
<div id="app">
  <canvas></canvas>
</div>
```

The canvas is the whole app. The navbar, the hero, every card — all painted onto that canvas by the GPU.

---

## 2. Boot in One Picture

```
index.html
  └─ <div id="app"></div>            (empty container)
        ↓
     Blits.Launch(App, 'app', ...)   (see src/index.js)
        ↓
     Blits creates <canvas> inside #app
        ↓
     Blits starts a frame loop → paint, paint, paint, 60 times/sec
```

That's it. Everything you see is drawn onto that one canvas, over and over.

---

## 3. Design Coordinates vs Real Screen

Blits pretends the screen is always **1920 wide × 1080 tall** (`w:1920, h:1080` in [src/index.js](src/index.js)). Every position in the code is in those design pixels.

The real TV might be 1280×720 or 3840×2160. Blits scales the whole picture automatically. You never write scaling code.

So when the Navbar says `x=64 y=46 size=40`, that means:

- 64 pixels from the left of a 1920-wide canvas
- 46 pixels from the top
- Text height 40

Whatever the real screen, Blits works out the ratio and stretches everything to fit.

---

## 4. The Render Tree — Nested Rectangles

Blits builds a **tree** of rectangles in memory. Every `<Element>` and `<Text>` in a template becomes one node in the tree.

Example — the Navbar template:

```
<Element w=1920 h=130 color=#0B0B0B>       (navbar bar)
  <Text content="lightDemo" x=64 y=46 />   (logo)
  <Element x=260 y=46>                     (Home tab wrapper)
    <Text content="Home" />                (tab label)
    <Element h=4 color=#00B3FF />          (underline)
  </Element>
</Element>
```

That becomes this tree:

```
Element (dark 1920×130 bar)
  ├─ Text "lightDemo"          at x=64,  y=46
  └─ Element (Home tab wrapper) at x=260, y=46
        ├─ Text "Home"
        └─ Element (blue underline)
```

Every frame, Blits walks this tree and tells the GPU: "paint a dark rectangle here, then paint text there, then paint another rectangle inside it, …".

**Coordinates are relative to the parent.** The underline strip's `y=42` means "42 pixels below its parent tab wrapper" — not 42 from the top of the screen. This is the most important idea in this whole file. Read it twice.

---

## 5. How a Card Actually Gets Drawn — Full Trace

Let's follow one card — "Silent Horizon" on the Trending Now rail — from data all the way to pixels.

### Step 1 — Data is built

In [src/data/home.js](src/data/home.js) a rail is created:

```js
createRail({ id: 'home-trending', title: 'Trending Now', genres: ['Action', 'Drama'] })
```

Inside `createRail` (see [src/data/contentFactory.js](src/data/contentFactory.js)) 15 plain JS objects are produced. Card #0 becomes:

```js
{
  id:    'home-trending-0',
  title: 'Silent Horizon',
  genre: 'Action',
  image: 'https://picsum.photos/seed/home-trending-city-0/260/300'
}
```

Nothing is painted yet. This is just data in memory.

### Step 2 — The rail template says "make a card here"

In [src/components/ContentRail.js](src/components/ContentRail.js):

```
<PosterCard :for="(item, index) in $items"
            :x="$index * 288"
            :image="$item.image"
            :title="$item.title" />
```

So for card #0 → `x = 0`. Card #1 → `x = 288`. Card #2 → `x = 576`. And so on. Where does `288` come from? Card width (260) + gap (28) = 288 pixels per step.

### Step 3 — PosterCard builds its own render nodes

The PosterCard template ([src/components/PosterCard.js](src/components/PosterCard.js)) says:

```
<Element w=260 h=390>                       (outer card box)
  <Element w=260 h=300 rounded=12           (image slot)
          src="{{image url}}" />
  <Text y=314 content="{{title}}" />        (title text)
  <Text y=348 content="{{genre}}" />        (genre text)
</Element>
```

So one card = 4 nested rectangles: outer box → image → title text → genre text.

### Step 4 — The GPU paints it

Blits tells the GPU: "draw a rectangle at these coordinates with this texture (or this colour)." The GPU does that for hundreds of rectangles in about 1 millisecond.

For the image rectangle, Blits also needs an actual picture. The first time it sees `src="https://picsum..."` it:

1. Kicks off an HTTP request in the background.
2. Draws the card as a plain white rectangle while it waits.
3. When the JPEG arrives, the browser decodes it.
4. Blits uploads the decoded pixels to a **texture** on the GPU.
5. On the next frame, the GPU paints that texture inside the card rectangle.

That is why cards briefly show as white boxes when a page first loads. They **are** drawn correctly — the picture just has not arrived yet.

---

## 6. Positions Combine — Why Scrolling Works

Card #2 in the Trending Now rail is drawn on-screen at:

```
outer card position on screen  =  page top-left offset
                               +  rail padding (x=64)
                               +  track offset (x=0 while not scrolled)
                               +  card index × 288
                               =  0 + 64 + 0 + 576
                               =  x=640, y=(some row Y)
```

Because each `<Element>` is placed **relative to its parent**, moving the rail track (the parent) automatically moves every card inside it. That is exactly how horizontal scroll works:

- Rail changes ONE number: `track.x` from 0 → -288.
- All 15 cards slide together, for free, without any card-by-card math.

Same trick vertically in [PageContainer.js](src/components/PageContainer.js). When you press Down, only the outer wrapper's `y` changes. Every rail and every card inside it moves along for free.

---

## 7. What "Transition" Actually Means

Any attribute can have `.transition` appended:

```
:x.transition="{value: 576, duration: 300, easing: 'smooth'}"
```

Blits does NOT jump the card from `0` to `576` on the next frame. Instead, on every frame for the next 300 ms, Blits calculates a middle value — `0`, then `19`, `70`, `140`, `260`, `380`, `500`, `576`. The GPU redraws the card at each step. That is what makes it *slide*.

The card texture is NOT re-decoded during that slide. Only the "where to paint it" number changes. That is why sliding is cheap — no CPU work, the GPU just paints the same texture at slightly different X each frame.

---

## 8. The Frame Loop — The Heartbeat

The browser calls `requestAnimationFrame` about 60 times a second (once per screen refresh). Each call:

1. Blits walks the render tree.
2. For each node whose position or texture changed, it updates the GPU.
3. GPU paints the whole frame in one pass.
4. Blits sleeps until the next frame.

If nothing changed (no animation, no new data), the loop still runs, but the GPU is idle. That is why "sitting still = ~0% work".

Our new [src/helpers/fps.js](src/helpers/fps.js) measures this loop from the outside. It runs its own `requestAnimationFrame`, times the gap between calls, and shows `50 fps 20.0 ms` in the navbar. The first number is how many frames per second the browser is delivering. The second is the average gap between frames — at a steady 60 fps that gap is `16.7 ms`; if it climbs, something is stealing time from the frame.

---

## 9. Culling — Why Off-Screen Cards Don't Waste Time

The rail is only 1792 pixels wide, but a 15-card track is `15 × 288 = 4320` pixels wide. Most cards are off-screen at any moment.

Blits does NOT paint what you cannot see. In [src/index.js](src/index.js) there is a setting `viewportMargin: 150` which tells Blits:

> "If a node is more than 150 pixels outside the visible area, skip it — don't ask the GPU to paint it, and don't keep its texture in memory."

This is essential on TV. Without culling, 90 cards worth of textures would live in GPU memory. With culling, only the 6-8 currently visible ones do.

---

## 10. Focus — Just Changing Numbers

When you press Right on a rail, [ContentRail.js](src/components/ContentRail.js) changes only two numbers:

- `selectedIndex` 0 → 1
- `scrollOffset` 0 → 288

That's it. No new elements are created. What happens visually:

- The border-alpha on card 0 fades from 1 → 0 (over 200 ms).
- The border-alpha on card 1 fades from 0 → 1 (over 200 ms).
- The track's `x` slides from 0 → -288 (over 300 ms).

Three number changes. The GPU repaints ~18 frames while these transitions run. Done.

Focus feels responsive because we changed **numbers**, not DOM elements.

---

## 11. Where Fonts Come From

Fonts also become textures on the GPU. When [src/index.js](src/index.js) says:

```
fonts: [{ family: 'roboto', type: 'web', file: 'fonts/Roboto-Regular.ttf' }]
```

Blits:
1. Downloads `Roboto-Regular.ttf` once, on boot.
2. Bakes each letter into a texture atlas on the GPU.
3. When you draw a `<Text content="Home" />`, the GPU stamps 4 letter-shaped rectangles side by side using that atlas.

That is why the FPS meter we added shows text so smoothly — it is just the same technique any other text uses.

---

## Recap in Five Sentences

1. The whole app is **one WebGL canvas**, painted by the GPU 60 times a second.
2. Every `<Element>` and `<Text>` in a template becomes a **node in a tree of rectangles** with positions relative to its parent.
3. Moving a parent moves all children **for free** — that is how scrolling works.
4. Images and letters both become **GPU textures**; before an image finishes downloading, its card is a plain white rectangle.
5. Animation ("transition") is just **interpolating one number across many frames** — no re-decoding, no re-layout, cheap on the GPU.

If you understand those five things, you understand how the whole app renders.
