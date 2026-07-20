import Blits from '@lightningjs/blits'

// STUB — real carousel with auto-play, slide transitions and Left/Right nav
// comes in step 6. For now it just renders the first slide's image + title
// and highlights on focus so the PageContainer focus flow is visible.
//
// Template pixel values are literals (Blits templates cannot interpolate JS).
// 1920x880 matches STAGE_W and HERO_HEIGHT in constants/layout.js.
export default Blits.Component('HeroCarousel', {
  template: `
    <Element w="1920" h="880">
      <Element w="1920" h="880" :src="$firstImage" fit="cover" />
      <Element
        w="1920"
        h="880"
        :color="$$hasFocus ? 'rgba(0, 179, 255, 0.12)' : 'rgba(0, 0, 0, 0.35)'"
      />
      <Text
        :content="$firstSubtitle"
        x="64"
        y="620"
        size="26"
        color="#00B3FF"
        font="roboto"
      />
      <Text
        :content="$firstTitle"
        x="64"
        y="660"
        size="64"
        color="#FFFFFF"
        font="roboto"
      />
      <Text
        :content="$firstDescription"
        x="64"
        y="750"
        size="24"
        color="#DDDDDD"
        font="roboto"
        maxwidth="1000"
        maxlines="2"
      />
    </Element>
  `,
  props: {
    slides: [],
  },
  computed: {
    firstSlide() {
      return this.slides && this.slides[0] ? this.slides[0] : {}
    },
    firstImage() {
      return this.firstSlide.image || ''
    },
    firstTitle() {
      return this.firstSlide.title || 'Hero'
    },
    firstSubtitle() {
      return this.firstSlide.subtitle || ''
    },
    firstDescription() {
      return this.firstSlide.description || ''
    },
  },
})
