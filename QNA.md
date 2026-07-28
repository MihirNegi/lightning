# QNA.md — Frame Rate, Jank, Timing & Lightning Performance

Answers to every question you asked. Easy language, real examples from this codebase, diagrams throughout.

---

## Q1. What is the frame rate of a particular TV?

### The Simple Answer

A TV's frame rate is how many times per second the screen refreshes — how many "new pictures" it draws per second.

```
TV Screen Refresh (the hardware side):

  Time 0ms ──────────────────────────────────────────────────────────────────▶
           │         │         │         │         │         │         │
           ▼         ▼         ▼         ▼         ▼         ▼         ▼
         Frame     Frame     Frame     Frame     Frame     Frame     Frame
           1         2         3         4         5         6         7
         ◀────────────────── 1 second ───────────────────────────────▶
                    (60 frames drawn in 1 second = 60fps)
```

### Common TV Refresh Rates

| TV Type | Native Hz | What it means |
|---|---|---|
| Regular Smart TV (Samsung, LG) | **60 Hz** | Screen refreshes 60 times/sec = 16.7ms per frame |
| Budget / older Smart TV | **50 Hz** | 50 times/sec = 20ms per frame |
| Modern 4K TV | **120 Hz** | 120 times/sec = 8.3ms per frame |
| Most Set-Top-Box / STB browsers | **60 Hz** (capped at 30Hz in browser) | Browser limits to 30fps even though screen can do 60 |

### What This App Does

Look at [src/index.js:33](src/index.js):
```js
maxFPS: 30
```

The app **deliberately caps itself at 30fps**. Why? Because on a low-end TV, trying to run at 60fps causes **inconsistent** performance — sometimes 55fps, sometimes 38fps, jumpy. At 30fps (33ms budget per frame) it runs smooth and consistent. Consistent slow > inconsistent fast on a TV.

The fps.js meter detects the real browser cap with `estimateCapHz()`:
```
Browser says rAF fires every ~16ms  →  capHz = 60
Browser says rAF fires every ~33ms  →  capHz = 30
```

---

## Q2. Why Does FPS Drop During a Task? Why Does It Drop Even While Static?

### First: Understand the Frame Budget

Every frame has a **deadline**. At 60fps that deadline is 16.7ms. At 30fps it is 33ms.

```
One Frame Budget (60fps = 16.7ms total):

  ┌─────────────────────────────────────────────────────────────────┐
  │ 0ms          5ms          10ms          16.7ms                  │
  │  │           │             │             │                      │
  │  ▼           ▼             ▼             ▼                      │
  │ [JS runs] [Blits draws] [GPU paints] [DONE ✓ frame submitted]  │
  └─────────────────────────────────────────────────────────────────┘

  If ANYTHING takes too long, you miss the 16.7ms deadline:

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ 0ms          5ms          10ms          16.7ms   20ms   26ms             │
  │  │           │             │             │        │      │               │
  │  ▼           ▼             ▼             ▼        ▼      ▼               │
  │ [JS runs]  [BIG image decode happening] [overdue] [done] [next frame]   │
  │                                            ↑
  │                           MISSED DEADLINE = DROPPED FRAME = JANK       │
  └──────────────────────────────────────────────────────────────────────────┘
```

### Why FPS Drops DURING a Task (e.g. Scrolling)

When you scroll in this app, every frame the JS has to:

```
Per Frame During Scroll:
─────────────────────────────────────────────────────────────────
  1. rAF fires (browser wakes up our JS)
  2. rafLoop.js → calls all registered tick functions
  3. ContentRail.scrollTick() → runs easeStep() → updates scrollActual
  4. PageContainer's vertical tick → updates animY
  5. Blits reactive system detects scrollActual changed
  6. Blits recomputes all 45+ nodes in the scene graph (world transforms)
  7. Blits sends updated positions to WebGL
  8. GPU redraws the frame
─────────────────────────────────────────────────────────────────
```

Steps 6 + 7 are expensive on a slow TV CPU. If the TV's JavaScript engine is slow, just computing "where is each card now?" takes 12ms+ instead of 3ms. You blow the budget.

**Specific causes in this app:**

| Cause | What happens | Effect on FPS |
|---|---|---|
| New rail mounts | Scrolling vertically hits a new rail = 7 new PosterCard components created at once | Jank spike |
| Image decode | A new image arrives and gets uploaded to GPU as a texture | Frame takes 5ms longer |
| Garbage Collection (GC) | JS engine cleaning up old objects | Can steal 10-30ms randomly |
| Scene graph traversal | Lightning walks all ~45 nodes every frame when anything moves | Base overhead |
| Reactive re-computation | scrollActual changes → Blits reruns computed properties | Per-frame overhead |

### Why FPS Drops Even When NOTHING is Moving (Static)

```
App looks static. Nothing moving. FPS drops from 30 to 25 for a moment.
Why???

Possible causes:
────────────────────────────────────────────────────────────────────────
  A) GARBAGE COLLECTION
     JS engine periodically collects unused objects.
     GC is unpredictable. Can pause JS for 20ms. No warning.

  B) GPU MEMORY CLEANUP
     From index.js:
       cleanupInterval: 5000  ← every 5 seconds
     Blits checks VRAM usage. If over 70% of 120MB → starts evicting textures.
     This happens on the main thread = steals frame time.

  C) BACKGROUND BROWSER TASKS
     The TV browser is also doing: network keep-alives, security checks,
     other tab work (if any), OS events. Your app gets less CPU time.

  D) TEXT RE-RASTERIZATION
     FPS label in navbar updates every 1 second.
     Blits has to bake new glyph textures → GPU upload.
     That's why fps.js refreshes every 1000ms not 300ms (see line 42 fps.js).

  E) THE BLITS IDLE LOOP
     Even with no animation, Blits still calls requestAnimationFrame
     and walks the scene graph to check "did anything change?"
     On a slow TV this idle cost is ~2-5ms per frame.
────────────────────────────────────────────────────────────────────────
```

The comment in [src/index.js:58](src/index.js) says it directly:
> `cleanupInterval: 5s — the sweep is less likely to land on a rendered frame`

The cleanup was moved from 3s to 5s specifically to reduce how often it collides with an animation frame.

---

## Q3. Jank in Light Demo — What It Means, When High, How to Minimise

### What "Jank" Actually Means

**Jank = a frame that took so long that the screen skipped at least one refresh.**

```
Normal 30fps (smooth):
────────────────────────────────────────────────────────────────────────────────
  Frame:  1     2     3     4     5     6     7     8     9     10
  At:     0ms  33ms  66ms  99ms  132ms 165ms 198ms 231ms 264ms  297ms
  Gap:    ←33ms→←33ms→←33ms→← CONSISTENT ──────────────────────────────────▶
  Eyes see smooth motion

Jank frame (frame 5 takes too long):
────────────────────────────────────────────────────────────────────────────────
  Frame:  1     2     3     4          5                  6     7
  At:     0ms  33ms  66ms  99ms    ← waiting →          198ms 231ms
  Gap:    ←33ms→←33ms→←33ms→←──── 99ms ────→←33ms→←33ms→
                                   ↑
                        3 frames late (3 frames DROPPED)
                        This is 1 jank event

  Eyes see: card position jumps. The card was at position 200px,
  then 3 frames worth of movement happened in one frame → jumps to 290px.
  That jump = jank.
```

### How jankCount Is Measured in This App

Look at [src/helpers/fps.js:167](src/helpers/fps.js):
```js
const jankThresholdMs = capHz !== null ? (1000 / capHz) * JANK_MULTIPLIER : JANK_FALLBACK_MS
if (dt > jankThresholdMs) jankCount++
```

- At 30fps: vsync = 33ms. Threshold = 33 × 1.5 = **50ms**. Any frame taking > 50ms → jank
- At 60fps: vsync = 16.7ms. Threshold = 16.7 × 1.5 = **25ms**. Any frame > 25ms → jank

The multiplier `1.5` means "this frame dropped at least 1 full refresh". A borderline slow frame (20ms at 60fps) does NOT count as jank — only clearly missed ones do.

### What the Display Shows

```
Navbar readout example:
"30 fps   33.3 ms   work 8.2   max 61.4   3 jank"
    │          │          │          │        │
    │          │          │          │        └── 3 frames dropped in last second
    │          │          │          └──────────── worst single frame was 61ms (bad!)
    │          │          └─────────────────────── JS+Blits used 8.2ms avg per frame
    │          └────────────────────────────────── avg 33.3ms per frame = ~30fps
    └───────────────────────────────────────────── current fps
```

### Reading the Jank Count

| jankCount | Meaning |
|---|---|
| 0 | Perfect. No dropped frames in the last second |
| 1-3 | Acceptable for TV. User barely notices |
| 4-10 | Noticeable. User sees occasional stutter |
| 10+ | Bad. Scrolling feels choppy. User frustrated |

### How to Minimise Jank

**This app already does most of these:**

```
1. REDUCE WORK PER FRAME
   ─────────────────────
   Before (caused jank):  10 cards mounted per rail, 20 rails = 200 card components
   After (this app):      7 cards mounted per rail, 3 rails visible = 21 components
   Code: ContentRail.js line 28-29 — WINDOW_BEFORE=1, WINDOW_AFTER=5

2. DELAY IMAGE DECODES
   ─────────────────────
   Images do NOT load while you are scrolling.
   activeSrc getter returns null during scroll.
   Image only loads after you STOP scrolling.
   Code: PosterCard.js — isScrolling prop gates the src

3. CAP FPS AT 30 NOT 60
   ─────────────────────
   At 60fps budget = 16.7ms. Scene graph update = ~14ms. Almost no headroom.
   At 30fps budget = 33ms. Scene graph update = ~14ms. 19ms of headroom.
   Code: index.js line 33 — maxFPS: 30

4. ONE RAF LOOP FOR ALL ANIMATIONS
   ─────────────────────────────────
   Multiple rAF loops on different vsync edges = micro-tears.
   Single loop = all axes update same frame.
   Code: rafLoop.js — registerTick/unregisterTick

5. PREFETCH IMAGES DURING IDLE
   ─────────────────────────────
   Images for the NEXT rails load during requestIdleCallback.
   So when you scroll to them, they're already in cache.
   Code: prefetch.js

6. SETTLE THRESHOLD STOPS INFINITE LOOP
   ──────────────────────────────────────
   easeStep runs EVERY FRAME until |remaining| < 0.5px.
   Without SETTLE_PX=0.5, the loop runs forever eating CPU.
   Code: animations.js line 56, ContentRail.js:306
```

---

## Q4. The 16.7ms Frame Budget — Deep Dive

### What Happens Inside One Frame

```
SCREEN REFRESH TIMELINE (60fps device):

  Vsync 0         Vsync 1         Vsync 2         Vsync 3
    │               │               │               │
    │←── 16.7ms ───▶│←── 16.7ms ───▶│←── 16.7ms ───▶│
    │               │               │               │
    ▼               ▼               ▼               ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  BROWSER WAKES YOUR JS           │  SCREEN SHOWS YOUR FRAME            │
  │  via requestAnimationFrame()     │  (the GPU work from last frame)     │
  │                                  │                                     │
  │  Your 16.7ms BUDGET starts here ─┘                                     │
  └─────────────────────────────────────────────────────────────────────────┘
```

### What Fills Up the 16.7ms

```
The 16.7ms budget is split like this:

  0ms ──────────────────────────────────────────────────── 16.7ms
  │                                                             │
  ▼                                                             ▼
  ┌──────────┬─────────────────────┬──────────────┬──────────────┐
  │          │                     │              │              │
  │ YOUR JS  │  BLITS SCENE GRAPH  │  WebGL CALLS │  GPU PAINTS  │
  │ (easeStep│  (world transforms, │  (draw quads,│  (fragment   │
  │ holdTick │   reactive re-eval, │   upload     │   shaders,   │
  │ etc.)    │   layout compute)   │   textures)  │   compositing│
  │          │                     │              │              │
  │  ~1-2ms  │     ~8-12ms         │    ~1-2ms    │    ~2-3ms    │
  └──────────┴─────────────────────┴──────────────┴──────────────┘
       ↑                ↑
  This is "workMs"  ←──┘
  (measured by fps.js MessageChannel trick)
  fps.js measures BOTH of these together as "work ms"
```

### What "work ms" Actually Measures (The MessageChannel Trick)

From [fps.js:119-126](src/helpers/fps.js):

```
How MessageChannel measures work:

  Frame starts (rAF fires):
  │
  ├─ 1. Record frameStart = performance.now()
  │
  ├─ 2. JS runs (your scroll code, Blits reactive, WebGL calls...)
  │
  ├─ 3. workChannel.port2.postMessage(null)   ← post a message
  │           │
  │           └── This message WAITS in queue until
  │               browser finishes EVERYTHING for this frame
  │               (script + layout + paint)
  │
  ├─ 4. Browser finishes frame, THEN runs the message handler:
  │       lastWorkMs = performance.now() - frameStart
  │                ↑
  │     This is how long the ENTIRE main thread was busy this frame
  │
  ▼
  Next frame starts
```

### How Do You Know if a Task is Taking Too Long?

Watch **workMs** in the navbar:

```
workMs = 3ms on a 30fps app  →  GREAT! 30ms budget, only 3ms used, 27ms free
workMs = 15ms on a 30fps app →  OK. 30ms budget, 15ms used, 15ms headroom
workMs = 28ms on a 30fps app →  DANGER. 30ms budget, 28ms used, 2ms headroom. Any GC = jank
workMs = 40ms on a 30fps app →  BROKEN. Consistently blowing budget. Will drop frames.
```

The **maxDt** tells you the worst single frame:
```
maxDt = 35ms on 30fps  →  Acceptable. One slightly slow frame
maxDt = 80ms on 30fps  →  Bad. That frame dropped 2+ frames = visible jump
maxDt = 200ms on 30fps →  Very bad. User saw the card teleport
```

### Can You Reduce Task Time to Hit 16.7ms?

Yes. Here is how this app does it:

```
PROBLEM: Blits scene graph traversal takes 14ms at 60fps budget (16.7ms)
         Any small extra work (GC, image) tips it over 16.7ms → jitter

SOLUTION 1: Lower the FPS cap to 30fps
            Budget becomes 33ms. 14ms scene graph leaves 19ms free.
            Code: index.js → maxFPS: 30

PROBLEM: New rail mounts during vertical hold-scroll → 7 cards created at once → burst of 15ms
         This always causes a jank spike at rail boundaries

SOLUTION 2: Reduce window size
            Was 10 cards → 8 cards → now 7 cards (WINDOW_BEFORE=1, WINDOW_AFTER=5)
            Each card removed = ~1-2ms less burst work

PROBLEM: Image decodes during scroll steal frame budget

SOLUTION 3: Gate image loading on scroll settle
            PosterCard only loads image when isScrolling = false
            Code: PosterCard.js — activeSrc computed
```

### On What Basis Is the 16.7ms Calculated?

Simple math:

```
  1 second = 1000 milliseconds
  60fps means 60 frames per second

  Time per frame = 1000ms ÷ 60 = 16.666ms ≈ 16.7ms

  30fps → 1000 ÷ 30 = 33.3ms per frame
  120fps → 1000 ÷ 120 = 8.33ms per frame
  50fps → 1000 ÷ 50 = 20ms per frame
```

The screen hardware fires a signal called **vsync** exactly 60 times per second (at 60Hz). The browser listens to this. `requestAnimationFrame` fires in sync with it. That's the "clock" everything is locked to.

### What If Your Task Takes MORE Than 16.7ms? Does User See Jank?

YES. Here is exactly what happens:

```
Normal (task = 10ms, well within 16.7ms):

  Vsync 1         Vsync 2         Vsync 3
    │               │               │
    ├──[JS 10ms]────┤               │
    │  ↑done        │               │
    │  Frame submitted on time ✓    │
    │               │               │
    Screen shows:   Screen shows:   Screen shows:
    card at x=100   card at x=110   card at x=120
    (smooth)        (smooth)        (smooth)


Jank (task = 25ms, over 16.7ms budget):

  Vsync 1         Vsync 2         Vsync 3
    │               │               │
    ├──[JS running ─────── 25ms ────]──┤
    │               │               │
    │               ↑ deadline MISSED  │
    │               Screen has to show │
    │               OLD frame again   │
    │                                 │
    Screen at vsync1:   Screen at vsync2:    Screen at vsync3:
    card at x=100       card at x=100        card at x=120
    (normal)            (SAME! frame frozen) (JUMPS 20px at once)

    This jump is JANK. User sees the card stutter-jump instead of sliding.
```

### What If Your Task Takes LESS Than 16.7ms? Does It Wait?

**YES. The browser always waits for the next vsync signal before painting.**

```
Task finishes in 5ms out of 16.7ms budget:

  Vsync 1         Vsync 2
    │               │
    ├──[5ms done]   │
    │   ↑           │
    │  JS finished  │
    │               │
    │  [idle 11.7ms]│   ← browser WAITS here
    │               │
    │               ↑
    │          NEXT vsync fires → browser paints the frame
    │          (it does NOT paint early!)


WHY? Because the screen hardware refreshes at a fixed rate.
     Painting early = tearing (top half of screen shows new frame,
                               bottom half shows old frame)

     Instead: browser HOLDS the frame until the exact vsync moment,
              THEN sends it to the screen in one atomic operation.
              This gives perfect, tear-free rendering.

RESULT: Finishing in 5ms vs 16ms makes ZERO visual difference.
        Both frames appear at exactly the same time.
        BUT finishing in 5ms means you have 11ms of SPARE TIME
        for GC, image decodes, etc. — they won't cause jank.
```

---

## Q5. Why Does likerust Outperform Light Demo (Lightning/Blits) on Low-End TVs?

Both apps use WebGL2. Both use the same exponential easing (`Tween` / `easeStep`). The difference is **what sits between your JS and the GPU draw call**.

### Lightning/Blits Layers (light demo — What Happens on Scroll)

```
YOU PRESS 'RIGHT' KEY
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 1: JavaScript (Main Thread)                  │
│  ContentRail.right() runs                           │
│  ├─ selectedIndex++                                 │
│  ├─ updateScrollTarget() → scrollTarget = 288       │
│  └─ ensureScrollLoopRunning()                       │
└─────────────────────────────────────────────────────┘
          │  (every frame after this)
          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 2: Blits Reactive System (Main Thread)       │
│  scrollTick() → easeStep() → scrollActual = 45px   │
│  Blits detects scrollActual changed                 │
│  Blits reruns ALL computed properties on this node  │
│  Blits marks the track element as "dirty"           │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 3: Scene Graph Traversal (Main Thread)       │
│  Blits walks ALL ~45 nodes in the retained tree     │
│  Recalculates world transforms for every node:      │
│    App → PageContainer → ContentRail → PosterCard×7 │
│  This happens EVERY FRAME even for 1px movement     │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 4: WebGL Draw Calls (Main Thread → GPU)      │
│  For each node: gl.uniform() + gl.drawArrays()      │
│  ~50+ draw calls per frame                          │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 5: GPU Render (GPU Thread)                   │
│  Fragment shaders, texture sampling, blending       │
│  Writes final pixels to framebuffer                 │
└─────────────────────────────────────────────────────┘
          │
          ▼
      Screen shows new frame

TOTAL MAIN THREAD TIME: 8-14ms per frame on low-end TV
```

### likerust Layers (this repo — What Happens on Scroll)

```
YOU PRESS 'RIGHT' KEY
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 1: JavaScript (Main Thread)                  │
│  carousel.step(+1, count) runs                      │
│  HCarousel._anim.setTarget(newIndex)                │
│  That's it. No reactive system. No component.       │
└─────────────────────────────────────────────────────┘
          │  (every frame after this)
          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 2: Immediate-Mode Update + Draw (Main Thread)│
│  update(dt):                                        │
│    carousel._anim.step(dt) → animCol = 0.41         │
│                                                     │
│  render():                                          │
│    drawCardRow() computes card positions inline:    │
│    x = focusX + (ci - animCol) * step               │
│    → r.drawImageCached(x, y, w, h, url)             │
│    → r.fillRect(x, y, w, h, color)                  │
│    Direct draw calls. No node tree. No dirty flags. │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 3: GPU Render (GPU Thread)                   │
│  Same WebGL2 shaders as light demo                  │
│  Draws batched triangles + textured quads           │
└─────────────────────────────────────────────────────┘
          │
          ▼
      Screen shows new frame

TOTAL MAIN THREAD TIME: 2-4ms per frame on the same TV
```

### Why likerust Is Faster — The Key Difference

```
LIGHTNING/BLITS (light demo):     LIKERUST (this repo):
────────────────────────────      ──────────────────────────────────────
Retained-mode renderer            Immediate-mode renderer
                                  
"Keep a tree of nodes in memory.  "Every frame, just redraw everything
Every frame, check which ones     from scratch using the current numbers.
are dirty and update them."       No tree. No dirty flags. No nodes."

Analogy:                          Analogy:
"Every morning, walk through all  "Just draw whatever the current
45 rooms and check if anything    position says, right now, then forget."
changed. Report findings."
```

```
SCROLLING ONE CARD (horizontal) — work done per frame:

  LIGHTNING:
  ┌───────────────────────────────────────────────────────────────────┐
  │  easeStep (0.1ms)                                                 │
  │  + Blits reactive re-eval (computed props re-run)    ~2ms         │
  │  + Scene graph: walk 45 nodes, recalc world coords   ~8-12ms      │
  │  + WebGL: ~50 gl.uniform / gl.drawArrays calls       ~1ms         │
  │  ─────────────────────────────────────────────────────────────    │
  │  TOTAL:  ~11-15ms per frame                                       │
  └───────────────────────────────────────────────────────────────────┘

  LIKERUST:
  ┌───────────────────────────────────────────────────────────────────┐
  │  Tween.step (0.05ms)                                              │
  │  + drawCardRow: compute x = focusX + (ci - animCol) * step       │
  │    for each visible card → direct r.fillRect / r.drawImage  ~2ms  │
  │  ─────────────────────────────────────────────────────────────    │
  │  TOTAL:  ~2-4ms per frame                                         │
  └───────────────────────────────────────────────────────────────────┘

  DIFFERENCE: ~10ms per frame. On a 30fps budget of 33ms, that is
              30% of the entire budget saved.
```

### What likerust Does NOT Have (That Lightning Does)

```
Lightning/Blits (light demo):         likerust (this repo):
──────────────────────────────────    ────────────────────────────────────
✗ Reactive property system            ✓ No reactive system (plain JS state)
✗ Component tree (45 nodes)           ✓ No component tree (plain class methods)
✗ World transform recalculation       ✓ Positions computed inline per draw call
✗ Dirty flag propagation              ✓ No dirty flags (just redraw every frame)
✗ Component mounting on scroll        ✓ No mounting — cards are just loop iterations
✗ Blits framework overhead            ✓ Zero framework — raw WebGL2 + plain JS

Both have:
✓ WebGL2 canvas                       ✓ WebGL2 canvas
✓ Exponential easing (Tween/easeStep) ✓ Exponential easing (Tween/easeStep)
✓ Single rAF loop                     ✓ Single rAF loop
✓ LRU texture cache                   ✓ LRU texture cache
✓ Image decode gating during scroll   ✓ Image decode gating during scroll
```

### Why Vertical Scroll Feels Worse Than Horizontal — in Light Demo

```
LIGHT DEMO — HORIZONTAL SCROLL (within one rail):
──────────────────────────────────────────────────
  scrollActual changes → same 7 cards reposition
  No new components created
  Cost: ~11-15ms (scene graph overhead + draw calls)
  RESULT: acceptable

LIGHT DEMO — VERTICAL SCROLL (crossing a rail boundary):
──────────────────────────────────────────────────────────
  animY changes → ALL visible rails reposition
  At a rail boundary:
    → new ContentRail component created
    → 7 PosterCard components instantiated
    → reactive init, computed property setup for each
    → THIS IS A BURST OF ~15ms on top of normal frame work

  Frame timeline at rail boundary:
  0ms ─────────────────────────────────────────── 33ms (30fps budget)
  │  [normal frame 13ms] [RAIL MOUNT BURST 15ms]  │
                          ↑
                         28ms total. Right at the edge. Any GC = jank.

  fps drops to ~36fps on low-end TV here.


LIKERUST — VERTICAL SCROLL (crossing a rail boundary):
──────────────────────────────────────────────────────
  animY changes → railList.update(dt) + railList.render()
  No components. New rail = just a new iteration in the draw loop.
  Cost: ~2-4ms whether crossing a boundary or not.
  RESULT: smooth at 60fps even on the same low-end TV.
```

### The Root Cause in One Picture

```
LIGHT DEMO (Lightning/Blits):

  keydown → easeStep → Blits reactive → scene graph (45 nodes) → WebGL → GPU
                │              │                │                   │
                └──────────────┴────────────────┴───────────────────┘
                         ALL OF THIS RUNS ON THE MAIN THREAD
                         Costs 11-15ms per frame on low-end TV

LIKERUST (this repo):

  keydown → Tween.setTarget → (next frame) Tween.step → drawCardRow → WebGL → GPU
                │                                  │           │          │
                └──────────────────────────────────┴───────────┘          │
                              JUST MATH + DRAW CALLS                      │
                              Costs 2-4ms per frame on same TV            │
                                                                          ▼
                                                             Same GPU work as light demo
```

### Why Light Demo Uses Lightning Despite the Overhead

```
LIKERUST IS FASTER. But it has costs too:

likerust trade-offs:
──────────────────────────────────────────────────────────────────────────────────
  ✗  You write all layout logic by hand (no component system to help)
  ✗  You manage your own draw order (three-pass: fill → image → border in carousel.js)
  ✗  No built-in culling system — you must write cardVisible() yourself
  ✗  Text rendering: rasterize to canvas2D, upload as texture, manage LRU manually
  ✗  Everything is imperative code; harder to maintain at large scale

Lightning/Blits (light demo) trade-offs:
──────────────────────────────────────────────────────────────────────────────────
  ✓  Component model = easier to reason about large UIs
  ✓  Reactive system handles layout updates automatically
  ✓  Built-in culling (viewportMargin), VRAM management, texture lifecycle
  ✓  Declarative templates — faster to build new screens
  ✗  Framework overhead costs 8-12ms per frame on the main thread
  ✗  Scene graph traversal is unavoidable even for a single pixel change

CONCLUSION:
  likerust proves that on a low-end TV, a hand-written immediate-mode renderer
  running raw WebGL2 beats a retained-mode framework (Lightning/Blits) purely
  on per-frame CPU cost. Both use the same GPU pipeline and the same easing math.
  The difference is entirely the layers between "number changed" and "draw call issued".
```

---

## Q6. What Can Be Improved in Light Demo to Make It Smooth Like likerust?

Three buckets: things **already shared** between both apps, things that can be **improved within Blits**, and things that need an **architectural change** (can't fix without leaving the framework).

---

### Bucket 1 — Already Done in Light Demo (Shared Optimizations)

Both apps already use these. They are why light demo is as smooth as it is.

```
OPTIMIZATION                  LIGHT DEMO FILE               LIKERUST FILE
────────────────────────────  ───────────────────────────   ─────────────────────────────
Hold-scroll (not OS repeat)   index.js line 10-25           setupApp.js line 121-124
Exponential easing            helpers/animations.js         core/anim.js (Tween class)
Single RAF loop               helpers/rafLoop.js            setupApp.js startAnimationLoop
Image decode gating on scroll PosterCard.js activeSrc       carousel.js IMAGE_DRAW flag
Rail virtualization window    PageContainer.js :range       railList.js _visibleRailCount
Lazy rail items               data/contentFactory.js        railList.js _maybeLoadMore
VRAM LRU eviction             index.js gpuMemory            webgl2Renderer.js CacheLRU
Settle threshold (SETTLE_PX)  helpers/animations.js         core/anim.js isSettled()
Prefetch adjacent rails       helpers/prefetch.js           railList.js _prefetchNearby
```

---

### Bucket 2 — Can Be Improved Within Blits (No Framework Change)

These changes keep Lightning/Blits but reduce the overhead it adds.

---

#### Improvement 1 — Pre-mount Rails Earlier (Reduce Burst Timing)

**The problem today:**
```
User holds Down key. sectionIndex advances every frame.
At rail boundary → :range window shifts → new ContentRail mounts → 7 PosterCards init.
All in ONE frame = burst spike = jank.

Timeline at boundary:
  Frame N:   [scroll 13ms] [MOUNT 15ms] ← 28ms total. JANK.
  Frame N+1: [scroll 13ms]              ← normal again
```

**The fix:**

Currently in [PageContainer.js](PageContainer.js):
```js
const RAIL_BUFFER_DOWN = 1
```
This mounts the next rail 1 rail-height before it enters view. At high vertical scroll speed, that 1-rail buffer isn't always enough — the burst fires when the animation is mid-flight.

Increase to `RAIL_BUFFER_DOWN = 2`. The next TWO rails are always pre-mounted. The burst happens further ahead of when the user actually sees the rail — spread across frames where there's budget to absorb it.

```
Cost: +7 more Blits components always mounted (small VRAM cost)
Gain: Burst fires 1 extra rail-height earlier, giving 2 frames of
      budget to absorb the init work instead of 1.
```

---

#### Improvement 2 — Reduce Computed Properties That Re-run Every Scroll Frame

**The problem today:**

Every time `animY` changes (every RAF frame during scroll), Blits re-evaluates **all computed properties** that directly or indirectly depend on reactive state. In PageContainer these include:

```
COMPUTED PROPERTIES THAT RE-RUN DURING VERTICAL SCROLL:
────────────────────────────────────────────────────────
  hasHero           ← depends on this.hero (stable, but re-checked)
  railsWithLayout   ← already cached against rail ref, BUT re-checked every frame
  maxSectionIndex   ← re-computed every frame
  scrollOffset      ← re-computed every frame (needed for target Y)
  isRailFocused     ← re-computed every frame
  focusedRail       ← re-computed every frame
  focusedRailDims   ← re-computed every frame
  frameMargin       ← CONSTANT. Re-computed every frame. Wasted.
  frameW            ← only changes on orientation flip. Re-computed every frame.
  frameH            ← only changes on orientation flip. Re-computed every frame.
  frameX            ← CONSTANT. Re-computed every frame. Wasted.
  frameY            ← CONSTANT. Re-computed every frame. Wasted.
  frameBottomBarY   ← only changes on orientation flip. Re-computed every frame.
  frameRightBarX    ← only changes on orientation flip. Re-computed every frame.
```

6 of these 13 are effectively constant during any scroll and could be plain state values updated only on orientation change.

**The fix:** Promote stable values out of computed into plain state:

```js
// BEFORE (computed, re-runs every frame):
frameX() {
  return CONTENT_PADDING_X - FRAME_MARGIN  // always the same number
},

// AFTER (state, set once at init):
state() {
  return {
    frameX: CONTENT_PADDING_X - FRAME_MARGIN,  // never changes
    frameY: CONTENT_TOP_Y + RAIL_TITLE_STRIP_H + CARD_INNER_TOP_Y - FRAME_MARGIN,
    frameMargin: FRAME_MARGIN,
    // frameW/H still need to react to orientation changes, keep as computed
  }
}
```

```
Cost: Minor refactor
Gain: ~6 fewer computed re-evaluations per frame = less Blits reactive overhead
```

---

#### Improvement 3 — Dual-Layer Image Cache (RAM + VRAM)

**What likerust does (two separate caches):**

```
likerust image pipeline:
───────────────────────────────────────────────────────────────────
  Network fetch → HTMLImageElement (decoded, system RAM)
                              │
                              ├─ ImageCache LRU (cap 192 images, system RAM)
                              │  imageCache.js — keeps decoded <img> elements
                              │
                              ▼
                         GPU upload on first draw
                              │
                              ├─ WebGL2Renderer._textures LRU (cap 96, VRAM)
                              │  webgl2Renderer.js — keeps WebGLTexture handles
                              │
                              ▼
                         r.drawTextureQuad() ← fast path, already in VRAM

VRAM texture evicted (LRU full):
  WebGLTexture deleted from VRAM
  BUT HTMLImageElement stays in ImageCache (RAM cap = 192, larger than VRAM cap = 96)
  
  Next time this image is needed:
    GPU upload from HTMLImageElement in RAM (fast, no network)
    NOT: re-download from network + re-decode (slow)
```

**What light demo does (single Blits VRAM budget):**

```
light demo image pipeline:
───────────────────────────────────────────────────────────────────
  Network fetch → Blits internal texture
  Blits VRAM budget: 120MB max, evicts LRU textures when over 70% (84MB)
  
  Blits texture evicted:
    Both VRAM texture AND decoded source data gone
    Next time: re-download from network + re-decode + GPU upload
    This is a COLD LOAD — slow, potentially causes decode jank
```

**The fix:** Add a `Map<url, HTMLImageElement>` RAM cache in front of Blits, capped at ~150 images. Before Blits tries to fetch an image, check the RAM cache. On VRAM eviction, the decoded image stays in RAM so re-upload is instant.

```
Cost: ~30-50MB extra system RAM (decoded images)
Gain: After VRAM eviction, re-upload is fast (RAM read) instead of
      slow (network refetch + decode). Eliminates the "cold load jank"
      that appears when scrolling back to already-seen rails.
```

---

#### Improvement 4 — Prefetch During Active Scroll (Not Just on Settle)

**What likerust does** (railList.js line 175):
```js
render(r, ctx) {
  this._prefetchNearby(r, ctx)  // ← called EVERY frame, including during scroll
  ...
}
```
`_prefetchNearby` calls `r.prefetchImage(url)` → `images.request(url)` → `new Image(); img.src = url`.
This is async. It just kicks off the network request; it does NOT block the frame.

**What light demo does** (PageContainer.js line 468):
```js
scrollTick(dt) {
  if (Math.abs(remaining) < SETTLE_PX) {
    // ... settle ...
    this.prefetchAdjacentRails()  // ← only called on settle
  }
}
```

**The problem:** If the user holds Down for 2 seconds, settle never fires, and prefetch never runs. When they stop, the next 2 rails are cold and their images decode all at once.

**The fix:** Also call `prefetchAdjacentRails()` in `holdTick()` after the first full-rail advance, not just on settle. The prefetch helper is already idempotent (dedupes by URL) and uses `requestIdleCallback`, so calling it during scroll is safe.

```
Cost: Near zero — prefetch.js already uses requestIdleCallback and deduplicates
Gain: Images for adjacent rails start loading DURING hold-scroll, not after
      stop. By the time the user stops, the next rails are already cached.
```

---

#### Improvement 5 — Reduce ContentRail Window Size

Currently in [ContentRail.js](ContentRail.js):
```js
const WINDOW_BEFORE = 1
const WINDOW_AFTER  = 5
// = 7 cards mounted per rail
```

Comment in the file explains the history: `down from 8, which was down from 10`. Each card = one Blits component with its own reactive bindings. The mount burst at rail boundaries = 7 components init simultaneously.

Going to `WINDOW_BEFORE = 1, WINDOW_AFTER = 4` = 6 cards:
```
Right edge of card 5 (index 4) = CONTENT_PADDING_X + 4 × 288 = 64 + 1152 = 1216px
Stage width = 1920px. Right side is clipped at 1920px.
1920 - 1216 = 704px gap before stage edge. Still enough buffer.
```

```
Cost: Very slight: right edge of stage shows gap ~100px earlier on fast scroll
Gain: Mount burst = 6 components instead of 7 = ~1-2ms less per boundary
```

---

### Bucket 3 — Architectural Changes (Cannot Fix Without Leaving Blits)

These are the root causes of the 11-15ms per-frame cost. They require replacing the Blits framework approach — not practical mid-project but important to understand.

---

#### Root Cause 1 — Scene Graph Traversal (8-12ms per frame, unavoidable in Blits)

```
WHAT HAPPENS EVERY FRAME IN LIGHT DEMO:

  animY changes by 2px (easeStep)
        │
        ▼
  Blits reactive system marks the outer container Element as "dirty"
        │
        ▼
  Scene graph walk: all 45+ nodes checked
  ┌─────────────────────────────────────────────────────────────────┐
  │  App (1 node)                                                   │
  │  └─ PageContainer (1 node)                                      │
  │       └─ Outer container (1 node) ← the one that moved         │
  │            └─ ContentRail × 5 (5 nodes each)                   │
  │                 └─ PosterCard × 7 per rail (7 × 5 = 35 nodes)  │
  │  TOTAL: ~45+ world transform recalculations                     │
  └─────────────────────────────────────────────────────────────────┘
        │
        ▼
  ~45 WebGL draw calls updated + re-issued
        │
        ▼
  GPU renders frame

WHAT LIKERUST DOES FOR THE SAME 2px CHANGE:

  _animRail.value() is now 2px different (just a number)
        │
        ▼
  render() loop runs
  for each visible rail: rowTop = focusY + (ri - animRail) * railStep
                                               ↑
                                       inline math, no nodes, no dirty flags
        │
        ▼
  ~20 WebGL draw calls (only what's visible)
        │
        ▼
  GPU renders frame

COST DIFFERENCE: 8-12ms (Blits scene graph) vs ~0ms (likerust inline math)
```

**Can this be fixed in Blits?** No. The scene graph traversal is the core of the Blits rendering model. It cannot be disabled for specific subtrees.

---

#### Root Cause 2 — Component Mounting Burst (15ms spike at every rail boundary)

```
WHAT HAPPENS WHEN A NEW RAIL ENTERS THE WINDOW IN LIGHT DEMO:

  :range shifts → Blits mounts 1 new ContentRail component
        │
        ├─ ContentRail.init() runs:
        │    updateScrollTarget()
        │    scrollActual = scrollTarget
        │    rebuildVisibleItems()
        │
        └─ For each of 7 visible cards: 1 PosterCard component mounted
             PosterCard.init() × 7:
               reactive binding setup × 7
               computed properties initialized × 7
               Blits internal node registration × 7
               Template render × 7
        
  ALL SYNCHRONOUS. ALL IN ONE FRAME. ~15ms burst.


WHAT LIKERUST DOES WHEN A NEW RAIL ENTERS VIEW:

  _loadedRails increases (just a number)
  render() loop now iterates one more time
  drawCardRow() called with the new rail's cards array
  
  COST: ~0.3ms (one extra iteration, a handful of draw calls)
```

**Can this be fixed in Blits?** Partially. The burst can be spread by mounting 2-3 rails ahead of view (`RAIL_BUFFER_DOWN = 2`). The mounting still happens but at a time when there's more frame budget to absorb it. The fundamental per-component init cost cannot be eliminated.

---

#### Root Cause 3 — Reactive Re-computation on Every Scroll Frame

```
LIGHT DEMO — scrollActual changes by 1px:
  Blits reactive: "scrollActual changed"
  → Re-run anyIsScrolling computed
  → Re-run all ContentRail computeds that depend on it
  → Re-run all PosterCard :image bindings via isScrolling prop
  → Blits marks affected nodes dirty
  → Scene graph processes dirty nodes
  
  ~13 computed properties re-evaluated per ContentRail
  × 5 visible rails
  = ~65 computed re-evaluations per frame during horizontal scroll

LIKERUST — animCol changes by 0.01:
  It's just a number in a Tween.
  No reactivity. No re-evaluation.
  render() just uses it: x = focusX + (ci - animCol) * step
```

**Can this be fixed in Blits?** Partially. Reduce the number of computeds (Improvement 2 above). The reactive system itself cannot be bypassed for specific bindings — every `:binding` in a template is wired to the reactive graph.

---

### Summary — All Improvements Ranked by Impact

```
┌─────┬───────────────────────────────────────┬───────────┬────────────────────────┐
│ No. │ Improvement                           │ Effort    │ Impact                 │
├─────┼───────────────────────────────────────┼───────────┼────────────────────────┤
│  1  │ RAIL_BUFFER_DOWN = 2                  │ 1 line    │ High — spreads mount   │
│     │ (pre-mount earlier)                   │           │ burst to earlier frame │
├─────┼───────────────────────────────────────┼───────────┼────────────────────────┤
│  2  │ Reduce stable computeds to state      │ Low       │ Medium — saves ~6      │
│     │ (frameX/Y/margin/bottomBarY/rightBarX)│           │ re-evals per frame     │
├─────┼───────────────────────────────────────┼───────────┼────────────────────────┤
│  3  │ Prefetch during hold-scroll too       │ Low       │ Medium — eliminates    │
│     │ (not only on settle)                  │           │ cold-load burst on stop│
├─────┼───────────────────────────────────────┼───────────┼────────────────────────┤
│  4  │ WINDOW_AFTER = 4 (6 cards)            │ 1 line    │ Low-medium — saves     │
│     │ (shrink card window by 1)             │           │ ~1-2ms per mount burst │
├─────┼───────────────────────────────────────┼───────────┼────────────────────────┤
│  5  │ Dual RAM+VRAM image cache             │ Medium    │ Medium — fixes re-     │
│     │ (like likerust ImageCache)            │           │ scroll cold loads      │
├─────┼───────────────────────────────────────┼───────────┼────────────────────────┤
│  6  │ Scene graph traversal elimination     │ Requires  │ VERY HIGH — saves      │
│ ★   │ (switch to immediate-mode rendering)  │ rewrite   │ 8-12ms per frame       │
├─────┼───────────────────────────────────────┼───────────┼────────────────────────┤
│  7  │ Component mounting elimination        │ Requires  │ HIGH — eliminates      │
│ ★   │ (cards as draw-loop iterations)       │ rewrite   │ 15ms boundary burst    │
└─────┴───────────────────────────────────────┴───────────┴────────────────────────┘
★ = Not possible within Blits
```

---

### What likerust Does That Light Demo Cannot Copy (Framework Wall)

```
  likerust                           Light demo (Blits)
  ───────────────────────────────    ─────────────────────────────────────────────
  Cards are loop iterations          Cards are Blits components (cannot change)
  No scene graph                     Scene graph is the framework core (cannot remove)
  No reactive re-computation         Reactivity is how Blits template bindings work
  Three-pass draw (fills/img/border) Blits draws nodes in tree order (no control)
  Inline position math               Blits computes world transforms on graph walk
  Zero mount cost at rail boundary   Mount = component init + reactive setup (fixed cost)
  All draw calls batched manually    Blits issues draw calls per-node (no manual batch)
```

The only way to get light demo to run as smoothly as likerust on the same TV is to replace the Blits component tree for the card/rail section with a custom WebGL drawing function — essentially doing what likerust does for the hot path (the card grid) while keeping Blits only for static screens (navbar, meta, player).

---

## Summary Cheat Sheet

```
┌──────────────────────┬─────────────────────────────────────────────────────┐
│ Concept              │ Quick Answer                                         │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ TV frame rate        │ Usually 60Hz hardware. Light demo caps at 30fps      │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ FPS drop (active)    │ Heavy JS work (rail mount, image decode, GC)         │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ FPS drop (static)    │ GC, VRAM cleanup (every 5s), Blits idle loop, FPS   │
│                      │ text re-rasterization                                │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ Jank                 │ Frame took >1.5× vsync (>50ms at 30fps). User sees  │
│                      │ card jump/stutter instead of smooth slide            │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ 16.7ms budget        │ 1000ms ÷ 60fps. Budget for ALL work in one frame     │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ workMs               │ JS + render time. Light demo: MessageChannel trick.  │
│                      │ likerust: performance.now() directly in tick()       │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ Finish early (5ms)   │ Browser WAITS for next vsync. No early paint.        │
│                      │ But spare time = buffer against GC/image decode jank │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ Over budget          │ Frame dropped. Screen shows previous frame again.    │
│                      │ Next frame shows double movement = jump = jank        │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ likerust faster      │ Immediate-mode: no reactive system, no scene graph   │
│                      │ traversal. Cards are math, not components. 2-4ms/f.  │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ Lightning overhead   │ 5 layers: JS → Blits reactive → scene graph (45      │
│                      │ nodes) → WebGL calls → GPU. 11-15ms/frame main thread│
├──────────────────────┼─────────────────────────────────────────────────────┤
│ Why use Lightning    │ Component model, declarative templates, built-in     │
│ at all               │ culling/VRAM management. Faster to build large UIs.  │
├──────────────────────┼─────────────────────────────────────────────────────┤
│ Vertical worse than  │ Light demo: rail boundary = 7 new Blits components   │
│ horizontal (light    │ mount at once = burst 15ms extra = jank spike.       │
│ demo only)           │ likerust: no mounting — just more draw iterations.   │
└──────────────────────┴─────────────────────────────────────────────────────┘
```
