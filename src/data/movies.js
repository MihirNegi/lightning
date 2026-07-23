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
  createRail({ id: 'movies-sci-fi', title: 'Sci-Fi', genres: ['Sci-Fi', 'Fantasy'] }),
  createRail({ id: 'movies-horror', title: 'Horror', genres: ['Horror', 'Thriller'] }),
  createRail({ id: 'movies-romance', title: 'Romance', genres: ['Romance', 'Drama'] }),
  createRail({ id: 'movies-animation', title: 'Animation', genres: ['Animation', 'Family'] }),
  createRail({ id: 'movies-docs', title: 'Documentaries', genres: ['Documentary', 'Nature'] }),
  createRail({
    id: 'movies-international',
    title: 'International Cinema',
    genres: ['Drama', 'Thriller'],
  }),
  createRail({ id: 'movies-award', title: 'Award Winners', genres: ['Drama', 'Biography'] }),
  createRail({
    id: 'movies-indie',
    title: 'Indie Spotlight',
    genres: ['Drama', 'Comedy', 'Mystery'],
  }),
  createRail({ id: 'movies-family', title: 'Family Night', genres: ['Family', 'Adventure'] }),
  createRail({ id: 'movies-war', title: 'War & History', genres: ['War', 'Drama'] }),
  createRail({ id: 'movies-musical', title: 'Musicals', genres: ['Musical', 'Drama'] }),
  createRail({ id: 'movies-biopic', title: 'Biopics', genres: ['Biography', 'Drama'] }),
  createRail({ id: 'movies-mystery', title: 'Mystery', genres: ['Mystery', 'Thriller'] }),
  createRail({ id: 'movies-cult', title: 'Cult Classics', genres: ['Cult', 'Drama'] }),
]

export default { hero, rails }
