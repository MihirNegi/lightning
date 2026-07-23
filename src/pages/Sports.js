import Blits from '@lightningjs/blits'
import PageContainer from '../components/PageContainer.js'
import sportsData from '../data/sports.js'

export default Blits.Component('Sports', {
  components: { PageContainer },
  template: '<PageContainer :rails="$rails" />',
  state() {
    return {
      rails: sportsData.rails,
    }
  },
})
