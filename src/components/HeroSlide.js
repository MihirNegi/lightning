import Blits from '@lightningjs/blits'
import { CONTENT_PADDING_X } from '../constants/layout.js'
import { DURATION, EASING, transition } from '../helpers/animations.js'

// x position for the copy block when the slide is active (visible) and
// inactive (about to fade in from a nudge to the left). The 60px offset
// gives the copy a subtle slide-in feel rather than a hard cut.
const COPY_X = CONTENT_PADDING_X
const COPY_X_INACTIVE = CONTENT_PADDING_X - 60

// A single hero banner slide: full-bleed background image, bottom-up dark
// gradient for text readability, and the slide copy on the left.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// 1920x880 matches STAGE_W and HERO_HEIGHT in constants/layout.js.
// color="#FFFFFF" on the image element is important: without it, the image
// would be tinted by whatever the default background color is.
export default Blits.Component('HeroSlide', {
  template: `
    <Element w="1920" h="880" :alpha.transition="$fadeTransition">
      <Element w="1920" h="880" :src="$image" fit="cover" color="#FFFFFF" />
      <Element w="1920" h="880" color="{bottom: '#0B0B0B', top: 'rgba(11, 11, 11, 0.15)'}" />
      <Element w="1920" h="260" y="620" color="{bottom: '#0B0B0B', top: 'rgba(11, 11, 11, 0)'}" />
      <Element y="520" w="900" :x.transition="$slideTransition">
        <Text :content="$subtitle" size="26" color="#00B3FF" font="roboto" />
        <Text
          y="42"
          :content="$title"
          size="64"
          color="#FFFFFF"
          font="roboto"
          maxwidth="900"
          maxlines="1"
        />
        <Text
          y="140"
          :content="$description"
          size="24"
          color="#DDDDDD"
          font="roboto"
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
    active: false,
  },
  computed: {
    // Fade in when active, out otherwise. Uses the hero (slow) duration so the
    // transition feels premium.
    fadeTransition() {
      return transition(this.active ? 1 : 0, { duration: DURATION.hero })
    },
    // Copy slides in from 60px to the left when becoming active — subtle motion
    // that reinforces the fade without dominating it.
    slideTransition() {
      return transition(this.active ? COPY_X : COPY_X_INACTIVE, {
        duration: DURATION.hero,
        easing: EASING.smooth,
      })
    },
  },
})
