import Blits from '@lightningjs/blits'
import { CARD_W, CARD_GAP } from '../constants/layout.js'
import { DURATION, EASING, transition } from '../helpers/animations.js'
import { getRailScrollOffset } from '../helpers/scroll.js'
import PosterCard from './PosterCard.js'

// Horizontally scrolling rail of poster cards. Owns real keyboard focus:
// Left/Right moves the selected card, and the previously selected card is
// remembered while the component instance is alive (via router keepAlive).
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// Height 466 = RAIL_TITLE_HEIGHT (76) + CARD_H (390). Width 1792 = RAIL_VISIBLE_WIDTH.
// 288 = CARD_W (260) + CARD_GAP (28). Keep in sync with constants/layout.js.
export default Blits.Component('ContentRail', {
  components: {
    PosterCard,
  },
  template: `
    <Element h="466">
      <Text
        :content="$title"
        size="32"
        font="roboto"
        :color="$$hasFocus ? '#FFFFFF' : '#AAAAAA'"
      />
      <Element y="52" w="1792" h="414" clipping="true">
        <Element :x.transition="$trackTransition">
          <PosterCard
            :for="(item, index) in $items"
            key="$item.id"
            y="8"
            :x="$index * 288"
            :title="$item.title"
            :genre="$item.genre"
            :image="$item.image"
            :progress="$item.progress"
            :focused="$$hasFocus && $index === $selectedIndex"
          />
        </Element>
      </Element>
    </Element>
  `,
  props: {
    title: '',
    items: [],
  },
  state() {
    return {
      selectedIndex: 0,
      scrollOffset: 0,
    }
  },
  computed: {
    trackTransition() {
      return transition(-this.scrollOffset, { duration: DURATION.base, easing: EASING.smooth })
    },
  },
  input: {
    left() {
      if (this.selectedIndex <= 0) return
      this.selectedIndex--
      this.updateScroll()
    },
    right() {
      if (this.selectedIndex >= this.items.length - 1) return
      this.selectedIndex++
      this.updateScroll()
    },
    enter() {
      // No-op for now — hook up navigation/playback later.
    },
  },
  methods: {
    // Recalculate horizontal scroll so the selected card sits at the left edge.
    updateScroll() {
      this.scrollOffset = getRailScrollOffset(this.selectedIndex, CARD_W, CARD_GAP)
    },
  },
})
