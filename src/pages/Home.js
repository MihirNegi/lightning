import Blits from '@lightningjs/blits'
import PageContainer from '../components/PageContainer.js'
import homeData from '../data/home.js'

export default Blits.Component('Home', {
  components: { PageContainer },
  template: '<PageContainer :hero="$hero" :rails="$rails" />',
  state() {
    return {
      hero: homeData.hero,
      rails: homeData.rails,
    }
  },
})
