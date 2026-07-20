import Blits from '@lightningjs/blits'
import PageContainer from '../components/PageContainer.js'
import sportsData from '../data/sports.js'

export default Blits.Component('Sports', {
  components: { PageContainer },
  template: '<PageContainer :hero="$hero" :rails="$rails" />',
  state() {
    return {
      hero: sportsData.hero,
      rails: sportsData.rails,
    }
  },
})
