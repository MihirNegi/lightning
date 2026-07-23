import Blits from '@lightningjs/blits'
import PageContainer from '../components/PageContainer.js'
import showsData from '../data/shows.js'

export default Blits.Component('Shows', {
  components: { PageContainer },
  template: '<PageContainer :rails="$rails" />',
  state() {
    return {
      rails: showsData.rails,
    }
  },
})
