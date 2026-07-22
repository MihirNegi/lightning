// Categories bias toward brighter, more colourful photos so posters have
// visible contrast. Picsum uses the seed for randomisation but categories
// nudge the type of image returned.
const POSTER_CATEGORIES = [
  'city',
  'architecture',
  'food',
  'travel',
  'people',
  'flowers',
  'colour',
  'street',
  'building',
]

const HERO_CATEGORIES = ['city', 'travel', 'architecture', 'landscape', 'sunset']

// Deterministic Lorem Picsum URL for a given seed. Same seed always produces
// the same image, so images don't reshuffle on reload or re-navigation.
function picsumUrl(seed, w, h) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`
}

// Build N poster image URLs for a rail. Prefix (usually rail id) keeps images
// unique across rails so the same poster never shows up twice on a page.
// Default dimensions request images at TV-appropriate sizes rather than the
// on-screen card dimensions — smaller source textures upload to the GPU
// faster and consume less VRAM. The renderer upscales at composite time,
// which is nearly free compared to decoding a bigger JPEG.
export function buildPosterImages(prefix, count, w = 180, h = 270) {
  const images = []
  for (let i = 0; i < count; i++) {
    const category = POSTER_CATEGORIES[i % POSTER_CATEGORIES.length]
    images.push(picsumUrl(`${prefix}-${category}-${i}`, w, h))
  }
  return images
}

// Build hero background image URLs for a page. Requested at ~2/3 of the
// on-stage size for the same reason as posters — TV composites will upscale
// with no perceptible loss and per-image decode cost drops significantly.
export function buildHeroImages(prefix, count, w = 1280, h = 586) {
  const images = []
  for (let i = 0; i < count; i++) {
    const category = HERO_CATEGORIES[i % HERO_CATEGORIES.length]
    images.push(picsumUrl(`hero-${prefix}-${category}-${i}`, w, h))
  }
  return images
}
