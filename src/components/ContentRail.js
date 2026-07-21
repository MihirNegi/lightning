import Blits from '@lightningjs/blits'
import { CARD_W, CARD_GAP } from '../constants/layout.js'
import { DURATION, EASING, HOLD_THROTTLE_MS, transition } from '../helpers/animations.js'
import { getRailScrollOffset } from '../helpers/scroll.js'
import PosterCard from './PosterCard.js'

// Lazy-mount window: how many cards to render around the current selection.
// ~7 cards fit in the visible clipping window, so BEFORE covers scroll-back
// and AFTER buffers forward scrolling. Cards outside the window are unmounted
// and their image textures freed — keeps GPU memory low on TV hardware.
const WINDOW_BEFORE = 3
const WINDOW_AFTER = 8

// Horizontal step per card slot: card width + inter-card gap.
const CARD_STEP = CARD_W + CARD_GAP

// Horizontally scrolling rail of poster cards. Owns real keyboard focus:
// Left/Right moves the selected card, and the previously selected card is
// remembered while the component instance is alive (via router keepAlive).
//
// The focus indicator is drawn HERE as a single static frame at slot (7, 3)
// inside the clipping window (i.e. wrapping the leftmost-visible card). The
// frame does NOT move — cards slide underneath the frame as the track scrolls
// left/right, and whichever card ends up in the focus slot appears framed.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// Height 466 = RAIL_TITLE_HEIGHT (76) + CARD_H (390). Width 1792 = RAIL_VISIBLE_WIDTH.
// 288 = CARD_W (260) + CARD_GAP (28). Frame is 270x310 (card 260x300 + 5px each side).
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
            :for="(item, index) in $visibleItems"
            key="$item.id"
            y="8"
            :x="$item.posX"
            :title="$item.title"
            :genre="$item.genre"
            :image="$item.image"
            :progress="$item.progress"
          />
        </Element>
        <Element
          x="7"
          y="3"
          w="270"
          h="310"
          :alpha.transition="{value: $$hasFocus ? 1 : 0, duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)'}"
        >
          <Element x="0" y="0" w="270" h="5" color="#FFFFFF" />
          <Element x="0" y="305" w="270" h="5" color="#FFFFFF" />
          <Element x="0" y="0" w="5" h="310" color="#FFFFFF" />
          <Element x="265" y="0" w="5" h="310" color="#FFFFFF" />
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
      // Timestamp of the last accepted directional press, used for hold-throttling.
      lastInputAt: 0,
    }
  },
  computed: {
    trackTransition() {
      return transition(-this.scrollOffset, { duration: DURATION.base, easing: EASING.smooth })
    },
    // Windowed slice of items to render. Each entry carries its absolute x
    // (posX) so filtering the array doesn't reindex the layout — cards stay
    // at the same on-screen position regardless of where the window starts.
    visibleItems() {
      const start = Math.max(0, this.selectedIndex - WINDOW_BEFORE)
      const end = Math.min(this.items.length, this.selectedIndex + WINDOW_AFTER + 1)
      const slice = []
      for (let i = start; i < end; i++) {
        slice.push({ ...this.items[i], posX: 12 + i * CARD_STEP })
      }
      return slice
    },
  },
  input: {
    left() {
      if (!this.acceptHoldInput()) return
      if (this.selectedIndex <= 0) return
      this.selectedIndex--
      this.updateScroll()
    },
    right() {
      if (!this.acceptHoldInput()) return
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
    // Returns true if enough time has passed since the last accepted press.
    // If true, also records the current time so the next call is throttled.
    // Used to stop key auto-repeat from firing 30 events per second.
    acceptHoldInput() {
      const now = Date.now()
      if (now - this.lastInputAt < HOLD_THROTTLE_MS) return false
      this.lastInputAt = now
      return true
    },
  },
})
