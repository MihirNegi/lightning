import Blits from '@lightningjs/blits'
import { CONTENT_PADDING_X } from '../constants/layout.js'

// A single hero banner slide: full-bleed background image, bottom-up dark
// gradient for text readability, and the slide copy on the left.
//
// Position is fully driven by the parent HeroCarousel via the slotX prop —
// the parent computes each slide's target x based on currentIndex, prevIndex
// and direction (see slidesWithSlot). This component just tweens its root x
// toward slotX over slotDuration ms. Duration is 0 for resting off-screen
// slides so they snap to the waiting position; the current + previous slides
// get the full hero duration and produce the directional slide.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// 1920x880 matches STAGE_W and HERO_HEIGHT in constants/layout.js.
// color="#FFFFFF" on the image element is important: without it, the image
// would be tinted by whatever the default background color is.
export default Blits.Component('HeroSlide', {
  template: `
    <Element
      w="1920"
      h="880"
      :x.transition="{value: $slotX, duration: $slotDuration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)'}"
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
    // Absolute x position for this slide's root, in stage px. -1920 = fully
    // off to the left, 0 = on-screen, +1920 = fully off to the right.
    slotX: 0,
    // Milliseconds for the :x.transition. 0 makes the panel snap (used for
    // off-screen slides waiting on the incoming side); DURATION.hero is used
    // for the current and outgoing slides so the transition is visible.
    slotDuration: 0,
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
    // Copy is now positioned by CONTENT_PADDING_X — the whole panel slides,
    // so a redundant per-slide copy-slide was removed with the alpha fade.
    copyX() {
      return CONTENT_PADDING_X
    },
  },
})
