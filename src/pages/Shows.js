import Blits from '@lightningjs/blits'
import PageContainer from '../components/PageContainer.js'
import showsData from '../data/shows.js'

export default Blits.Component('Shows', {
  components: { PageContainer },
  template: '<PageContainer :hero="$hero" :rails="$rails" />',
  state() {
    return {
      hero: showsData.hero,
      rails: showsData.rails,
    }
  },
})
