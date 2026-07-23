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
  createRail({ id: 'home-action', title: 'Action & Adventure', genres: ['Action', 'Adventure'] }),
  createRail({ id: 'home-comedy', title: 'Comedy Picks', genres: ['Comedy', 'Family'] }),
  createRail({ id: 'home-sci-fi', title: 'Sci-Fi & Fantasy', genres: ['Sci-Fi', 'Fantasy'] }),
  createRail({ id: 'home-docs', title: 'Documentaries', genres: ['Documentary', 'Nature'] }),
  createRail({ id: 'home-family', title: 'Family Favourites', genres: ['Family', 'Animation'] }),
  createRail({ id: 'home-award', title: 'Award Winners', genres: ['Drama', 'Biography'] }),
  createRail({
    id: 'home-international',
    title: 'International Hits',
    genres: ['Drama', 'Thriller'],
  }),
  createRail({ id: 'home-classics', title: 'Timeless Classics', genres: ['Drama', 'Crime'] }),
  createRail({
    id: 'home-because-you-watched',
    title: 'Because You Watched',
    genres: ['Action', 'Mystery', 'Drama'],
  }),
  createRail({ id: 'home-editors', title: "Editor's Picks", genres: ['Drama', 'Comedy'] }),
  createRail({ id: 'home-late-night', title: 'Late Night', genres: ['Comedy', 'Thriller'] }),
  createRail({ id: 'home-critics', title: 'Critics Choice', genres: ['Drama', 'Biography'] }),
  createRail({ id: 'home-hidden-gems', title: 'Hidden Gems', genres: ['Drama', 'Mystery'] }),
  createRail({ id: 'home-just-added', title: 'Just Added', genres: ['Action', 'Drama'] }),
]

export default { hero, rails }
