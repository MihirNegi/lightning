import { buildPosterImages, buildHeroImages } from './images.js'

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

// Build a single content rail. Default of 20 cards per rail — the rail
// virtualiser inside ContentRail only mounts the on-screen slice, so the
// per-rail draw cost is unaffected by count; it only grows the horizontal
// scroll length. Callers can override count per rail if needed.
export function createRail({ id, title, genres, count = 20, withProgress = false }) {
  const images = buildPosterImages(id, count)
  const seedBase = hashString(id)
  const items = []
  for (let i = 0; i < count; i++) {
    items.push({
      id: `${id}-${i}`,
      title: generateTitle(seedBase + i),
      genre: genres[i % genres.length],
      image: images[i],
      progress: withProgress ? 0.15 + ((i * 13) % 70) / 100 : undefined,
    })
  }
  return { id, title, items }
}

// Build the hero carousel slides for a page, attaching a background image to each.
export function createHeroSlides({ id, slides }) {
  const images = buildHeroImages(id, slides.length)
  return slides.map((slide, index) => ({
    id: `${id}-hero-${index}`,
    image: images[index],
    ...slide,
  }))
}
