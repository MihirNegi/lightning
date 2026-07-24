import Blits from '@lightningjs/blits'
import { CONTENT_PADDING_X } from '../constants/layout.js'

// A single hero banner slide: full-bleed background image, bottom-up dark
// gradient for text readability, and the slide copy on the left.
//
// Position is set directly by the parent HeroCarousel via the x prop.
// HeroCarousel lays all slides side-by-side in a filmstrip and scrolls the
// whole strip with a rAF ease loop — individual slides do not tween their
// own x, they just sit at the position the parent gives them.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// 1920x880 matches STAGE_W and HERO_HEIGHT in constants/layout.js.
// color="#FFFFFF" on the image element is important: without it, the image
// would be tinted by whatever the default background color is.
export default Blits.Component('HeroSlide', {
  template: `
    <Element
      :x="$x"
      w="1920"
      h="880"
    >
      <Element w="1920" h="880" :src="$imageSrc" fit="cover" color="#FFFFFF" />
      <Element w="1920" h="880" color="{bottom: '#0B0B0B', top: 'rgba(11, 11, 11, 0.15)'}" />
      <Element w="1920" h="260" y="620" color="{bottom: '#0B0B0B', top: 'rgba(11, 11, 11, 0)'}" />
      <Element :x="$copyX" y="520" w="900">
        <Text :content="$subtitle" size="26" color="#00B3FF" />
        <Text
          y="42"
          :content="$title"
          size="64"
          color="#FFFFFF"
          maxwidth="900"
          maxlines="1"
        />
        <Text
          y="140"
          :content="$description"
          size="24"
          color="#DDDDDD"
          maxwidth="820"
          maxlines="2"
          lineheight="34"
        />
      </Element>
    </Element>
  `,
  props: {
    image: '',
    title: '',
    subtitle: '',
    description: '',
    // Absolute x position of this slide inside HeroCarousel's scrolling
    // strip, in stage px. The strip lays slide i at i * STAGE_W and adds
    // clones at -STAGE_W and N*STAGE_W so the wrap is visually continuous.
    x: 0,
  },
  computed: {
    // Image src descriptor with keepAlive so the hero texture survives this
    // slide's unmount (e.g. on tab switch or scrolling out of range) and is
    // reused on remount instead of being re-fetched, re-decoded, and
    // re-uploaded to the GPU. Big textures (1280x586) are expensive to
    // upload; texture reuse across tab switches removes that cost entirely
    // when the user returns to a tab.
    imageSrc() {
      return { src: this.image, keepAlive: true }
    },
    // Copy is positioned by CONTENT_PADDING_X so titles sit flush with the
    // rail titles below the hero.
    copyX() {
      return CONTENT_PADDING_X
    },
  },
})
