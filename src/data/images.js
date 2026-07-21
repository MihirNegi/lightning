// Local image pools bundled under static/images/. Kept small and cycled by a
// deterministic seed hash so the same rail always shows the same posters
// across reloads, but the whole pool is only a few hundred KB — no network
// fetches, no per-image decode variance, and textures upload once from local
// disk. Big smoothness win on TV hardware where Picsum's variable latency
// was one of the largest sources of per-frame jank.
const POSTER_POOL_SIZE = 24
const HERO_POOL_SIZE = 12

// Small deterministic hash so the same key always maps to the same pool
// slot. Not cryptographic — just needs to spread indices evenly.
function hashKey(value) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1000003
  }
  return hash
}

// Format a 1-based index as a zero-padded two-digit string, matching the
// filenames on disk (poster-01.jpg, hero-07.jpg, ...).
function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`
}

// Build N poster image paths for a rail. Cycles through the local pool
// keyed by the rail prefix + item index, so different rails show different
// images and the same rail always shows the same ones.
export function buildPosterImages(prefix, count) {
  const images = []
  for (let i = 0; i < count; i++) {
    const slot = (hashKey(`${prefix}-${i}`) % POSTER_POOL_SIZE) + 1
    images.push(`images/posters/poster-${pad2(slot)}.jpg`)
  }
  return images
}

// Build N hero image paths for a page, cycled from the local hero pool.
export function buildHeroImages(prefix, count) {
  const images = []
  for (let i = 0; i < count; i++) {
    const slot = (hashKey(`hero-${prefix}-${i}`) % HERO_POOL_SIZE) + 1
    images.push(`images/heroes/hero-${pad2(slot)}.jpg`)
  }
  return images
}

// Enumerate every unique image URL the app will ever request. buildPosterImages
// and buildHeroImages cycle through fixed pools, so listing the pool slots
// directly covers every URL any rail or hero on any page can produce. Used by
// TexturePrewarm at boot to force Lightning to load and GPU-upload every
// texture ahead of time — so when a PosterCard or HeroSlide later mounts, the
// texture is already resident and no frame is dropped on first paint.
export function getAllImageUrls() {
  const urls = []
  for (let slot = 1; slot <= POSTER_POOL_SIZE; slot++) {
    urls.push(`images/posters/poster-${pad2(slot)}.jpg`)
  }
  for (let slot = 1; slot <= HERO_POOL_SIZE; slot++) {
    urls.push(`images/heroes/hero-${pad2(slot)}.jpg`)
  }
  return urls
}
