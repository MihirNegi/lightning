import Blits from '@lightningjs/blits'

// A single poster card. Prop-driven — the parent rail owns real keyboard focus
// and tells this card when it is selected via the `focused` prop.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// 260x390 total; image area is 260x300; title/genre strip below at y=314.
// Matches CARD_W, CARD_H in constants/layout.js.
//
// Perf choices vs reference:
//   - No blurred shadow (very expensive on TV GPU)
//   - No scale animation on focus (only border + title color change)
//   - No outer soft glow
//   - No skeleton loader (kept dark card background as fallback)
export default Blits.Component('PosterCard', {
  template: `
    <Element w="260" h="390" :zIndex="$focused ? 10 : 1">
      <Element
        w="260"
        h="300"
        :rounded="12"
        color="#FFFFFF"
        :src="$image"
        fit="cover"
      >
        <Element :show="$hasProgress" y="294" w="260" h="6" color="rgba(255, 255, 255, 0.25)">
          <Element h="6" color="#00B3FF" :w="$progressBarWidth" />
        </Element>
      </Element>
      <Element
        w="260"
        h="300"
        :rounded="12"
        :border="{width: 3, color: '#FFFFFF'}"
        :alpha.transition="{value: $focused ? 1 : 0, duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)'}"
      />
      <Text
        y="314"
        :content="$title"
        size="24"
        :color="$focused ? '#00B3FF' : '#FFFFFF'"
        font="roboto"
        maxwidth="260"
        maxlines="1"
      />
      <Text
        y="348"
        :content="$genre"
        size="18"
        color="#AAAAAA"
        font="roboto"
        maxwidth="260"
        maxlines="1"
      />
    </Element>
  `,
  props: {
    title: '',
    genre: '',
    image: '',
    progress: undefined,
    focused: false,
  },
  computed: {
    hasProgress() {
      return typeof this.progress === 'number'
    },
    progressBarWidth() {
      if (typeof this.progress !== 'number') return 0
      const clamped = Math.min(Math.max(this.progress, 0), 1)
      return Math.round(260 * clamped)
    },
  },
})
