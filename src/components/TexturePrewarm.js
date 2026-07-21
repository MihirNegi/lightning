import Blits from '@lightningjs/blits'
import { getAllImageUrls } from '../data/images.js'

// Hidden container that forces Lightning to load and GPU-upload every image
// URL used anywhere in the app, at boot. Real PosterCards and HeroSlides
// mounted later reference the same URLs and get a texture-cache hit rather
// than a first-time upload — which on Vida TV was costing 1 dropped frame
// per horizontal card slide (window slides right, new card texture uploads
// on its first-visible frame) and 3+ dropped frames per new rail entering
// the viewport (~10 card uploads compressed into one frame).
//
// Sizing 260x300 matches PosterCard dimensions so Lightning treats these as
// real render targets and decodes the full source image. Lightning's texture
// cache is keyed by URL (not by requested display size), so a load here also
// serves HeroSlide's 1920x880 usage of the same source files — decoded
// pixels are the same, Lightning downscales at draw time.
//
// alpha=0.01 (not 0): a fully-transparent node may be culled from the
// render pipeline on some builds, which could also skip the texture load
// and defeat the whole point. 0.01 is visually indistinguishable from 0
// but keeps the node in the pipeline so its src is honored.
//
// Kept mounted for app lifetime: if Lightning's texture cache is refcount-
// based, unmounting the last reference could evict the texture and re-
// introduce the upload spike we're trying to prevent.
export default Blits.Component('TexturePrewarm', {
  template: `
    <Element>
      <Element
        :for="(url, index) in $urls"
        key="$url"
        w="260"
        h="300"
        alpha="0.01"
        :src="$url"
      />
    </Element>
  `,
  state() {
    return {
      urls: getAllImageUrls(),
    }
  },
})
