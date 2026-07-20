import { createRail, createHeroSlides } from './contentFactory.js'

const hero = createHeroSlides({
  id: 'home',
  slides: [
    {
      title: 'Silent Horizon',
      subtitle: 'A New Original Series',
      description: 'Follow a lone ranger across untamed mountains in search of a legend.',
    },
    {
      title: 'Ocean Requiem',
      subtitle: 'Documentary Premiere',
      description:
        'Dive into the deep blue and discover the fragile beauty of life beneath the waves.',
    },
    {
      title: 'Wildfire Kingdom',
      subtitle: 'Season 2 Now Streaming',
      description: 'Power, betrayal and survival collide in the untamed heart of the wilderness.',
    },
  ],
})

const rails = [
  createRail({
    id: 'home-trending',
    title: 'Trending Now',
    genres: ['Action', 'Drama', 'Thriller'],
  }),
  createRail({
    id: 'home-popular',
    title: 'Popular Right Now',
    genres: ['Drama', 'Comedy', 'Romance'],
  }),
  createRail({
    id: 'home-continue',
    title: 'Continue Watching',
    genres: ['Drama', 'Action', 'Sci-Fi'],
    withProgress: true,
  }),
  createRail({
    id: 'home-recommended',
    title: 'Recommended For You',
    genres: ['Drama', 'Thriller', 'Mystery'],
  }),
  createRail({ id: 'home-top-rated', title: 'Top Rated', genres: ['Drama', 'Crime'] }),
  createRail({ id: 'home-new', title: 'New Releases', genres: ['Action', 'Comedy', 'Drama'] }),
]

export default { hero, rails }
