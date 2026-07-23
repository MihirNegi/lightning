import { createRail } from './contentFactory.js'

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

export default { rails }
