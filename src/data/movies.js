import { createRail, createHeroSlides } from './contentFactory.js'

const hero = createHeroSlides({
  id: 'movies',
  slides: [
    {
      title: 'The Last Summit',
      subtitle: 'Award-Winning Film',
      description:
        'One climber. One mountain. A journey that will test the limits of human endurance.',
    },
    {
      title: 'Emerald Frontier',
      subtitle: 'Exclusive Original',
      description:
        'An expedition into uncharted forests uncovers secrets the world was never meant to find.',
    },
    {
      title: 'Restless Tide',
      subtitle: 'New This Week',
      description:
        'A coastal town is shaken when the sea gives up a mystery decades in the making.',
    },
  ],
})

const rails = [
  createRail({
    id: 'movies-trending',
    title: 'Trending Movies',
    genres: ['Action', 'Drama', 'Thriller'],
  }),
  createRail({ id: 'movies-blockbusters', title: 'Blockbusters', genres: ['Action', 'Adventure'] }),
  createRail({ id: 'movies-drama', title: 'Drama', genres: ['Drama', 'Romance'] }),
  createRail({ id: 'movies-comedy', title: 'Comedy', genres: ['Comedy', 'Family'] }),
  createRail({ id: 'movies-thriller', title: 'Thrillers', genres: ['Thriller', 'Mystery'] }),
  createRail({ id: 'movies-classics', title: 'Classics', genres: ['Drama', 'Crime'] }),
]

export default { hero, rails }
