import Blits from '@lightningjs/blits'
import PageContainer from '../components/PageContainer.js'
import moviesData from '../data/movies.js'

export default Blits.Component('Movies', {
  components: { PageContainer },
  template: '<PageContainer :rails="$rails" />',
  state() {
    return {
      rails: moviesData.rails,
    }
  },
})
