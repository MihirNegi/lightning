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
export function buildPosterImages(prefix, count, w = 260, h = 300) {
  const images = []
  for (let i = 0; i < count; i++) {
    const category = POSTER_CATEGORIES[i % POSTER_CATEGORIES.length]
    images.push(picsumUrl(`${prefix}-${category}-${i}`, w, h))
  }
  return images
}

// Build hero background image URLs for a page.
export function buildHeroImages(prefix, count, w = 1920, h = 880) {
  const images = []
  for (let i = 0; i < count; i++) {
    const category = HERO_CATEGORIES[i % HERO_CATEGORIES.length]
    images.push(picsumUrl(`hero-${prefix}-${category}-${i}`, w, h))
  }
  return images
}
