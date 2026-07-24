import Blits from '@lightningjs/blits'
import { CONTENT_PADDING_X } from '../constants/layout.js'

// A single hero banner slide: full-bleed background image, bottom-up dark
// gradient for text readability, and the slide copy on the left.
//
// Position is set by the parent HeroCarousel via `:x="$entry.x"` on the
// HeroSlide component element. Blits applies that x to this component's
// root Element automatically — do NOT declare `x` as a component prop or
// re-bind :x inside the template, or it collides with the built-in
// positioning shortcut and the slide fails to render (which is what
// happened during the first pass of the smooth-scroll refactor).
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// 1920x880 matches STAGE_W and HERO_HEIGHT in constants/layout.js.
// color="#FFFFFF" on the image element is important: without it, the image
// would be tinted by whatever the default background color is.
export default Blits.Component('HeroSlide', {
  template: `
    <Element w="1920" h="880">
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
