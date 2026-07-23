import { buildPosterImages, buildHeroImages } from './images.js'

// Shared sample video for the Meta -> Player flow. A small mp4 kept on
// Blender's public mirror (Big Buck Bunny, ~5MB, CORS-friendly). Every
// item uses the same URL for the demo — real content plumbing would
// pass a per-item HLS/DASH manifest instead.
const SAMPLE_VIDEO_URL =
  'https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4'

const ADJECTIVES = [
  'Silent',
  'Crimson',
  'Last',
  'Broken',
  'Hidden',
  'Golden',
  'Endless',
  'Wild',
  'Frozen',
  'Rising',
  'Lost',
  'Eternal',
]

const NOUNS = [
  'Horizon',
  'Ember',
  'Kingdom',
  'Legacy',
  'Shadow',
  'Tide',
  'Voyage',
  'Echo',
  'Storm',
  'Summit',
  'Empire',
  'Odyssey',
]

// Small deterministic hash so the same rail id always produces the same titles.
function hashString(value) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000
  }
  return hash
}

// Deterministically pick an adjective + noun pair from a numeric seed.
function generateTitle(seed) {
  const adjective = ADJECTIVES[seed % ADJECTIVES.length]
  const noun = NOUNS[(seed * 7 + 3) % NOUNS.length]
  return `${adjective} ${noun}`
}

// Image request dimensions per orientation. Smaller than the on-screen
// card so texture upload + JPEG decode stay cheap on TV hardware — the
// renderer upscales at composite time, which is nearly free.
const IMG_DIMS_PORTRAIT = { w: 180, h: 270 }
const IMG_DIMS_LANDSCAPE = { w: 320, h: 180 }

// Deterministically pick an orientation for a rail from its id hash. Same
// rail id always resolves to the same orientation across reloads so the
// visual layout is stable — page scroll math depends on it. Simple parity
// keeps roughly half of rails in each orientation without any bias per
// page (the ids are page-prefixed so different pages see different mixes).
function orientationFor(id) {
  return hashString(id) % 2 === 0 ? 'portrait' : 'landscape'
}

// Build a single content rail. Default of 20 cards per rail — the rail
// virtualiser inside ContentRail only mounts the on-screen slice, so the
// per-rail draw cost is unaffected by count; it only grows the horizontal
// scroll length. Callers can override count per rail if needed. Orientation
// is derived from the rail id but can be forced via the option — useful if
// a specific rail (e.g. a "Continue Watching" row) needs a particular look.
export function createRail({ id, title, genres, count = 20, withProgress = false, orientation }) {
  const chosenOrientation = orientation || orientationFor(id)
  const imgDims = chosenOrientation === 'landscape' ? IMG_DIMS_LANDSCAPE : IMG_DIMS_PORTRAIT
  const images = buildPosterImages(id, count, imgDims.w, imgDims.h)
  const seedBase = hashString(id)
  const items = []
  for (let i = 0; i < count; i++) {
    const genre = genres[i % genres.length]
    items.push({
      id: `${id}-${i}`,
      title: generateTitle(seedBase + i),
      genre,
      image: images[i],
      progress: withProgress ? 0.15 + ((i * 13) % 70) / 100 : undefined,
      // Description is synthesized from the genre so every card has copy
      // to show on the Meta screen without needing a per-item write-up.
      description:
        `An engrossing ${genre.toLowerCase()} feature. Placeholder synopsis for the demo — ` +
        'the Meta screen wraps this into a two-column layout with the poster on the left.',
      video: SAMPLE_VIDEO_URL,
    })
  }
  return { id, title, items, orientation: chosenOrientation }
}

// Build the hero carousel slides for a page, attaching a background image to each.
export function createHeroSlides({ id, slides }) {
  const images = buildHeroImages(id, slides.length)
  return slides.map((slide, index) => ({
    id: `${id}-hero-${index}`,
    image: images[index],
    video: SAMPLE_VIDEO_URL,
    ...slide,
  }))
}
