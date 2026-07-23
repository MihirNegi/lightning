import { createRail } from './contentFactory.js'

const rails = [
  createRail({
    id: 'shows-trending',
    title: 'Trending Shows',
    genres: ['Drama', 'Thriller', 'Sci-Fi'],
  }),
  createRail({ id: 'shows-originals', title: 'Originals', genres: ['Drama', 'Crime'] }),
  createRail({ id: 'shows-comedy', title: 'Comedy Series', genres: ['Comedy', 'Family'] }),
  createRail({ id: 'shows-reality', title: 'Reality', genres: ['Reality', 'Game Show'] }),
  createRail({ id: 'shows-anime', title: 'Anime', genres: ['Anime', 'Action'] }),
  createRail({ id: 'shows-docs', title: 'Documentaries', genres: ['Documentary', 'Nature'] }),
  createRail({ id: 'shows-crime', title: 'Crime & Mystery', genres: ['Crime', 'Mystery'] }),
  createRail({ id: 'shows-sci-fi', title: 'Sci-Fi & Fantasy', genres: ['Sci-Fi', 'Fantasy'] }),
  createRail({ id: 'shows-drama', title: 'Drama Series', genres: ['Drama', 'Romance'] }),
  createRail({ id: 'shows-teen', title: 'Teen Series', genres: ['Drama', 'Comedy'] }),
  createRail({ id: 'shows-kids', title: 'Kids & Family', genres: ['Family', 'Animation'] }),
  createRail({
    id: 'shows-international',
    title: 'International Series',
    genres: ['Drama', 'Thriller'],
  }),
  createRail({ id: 'shows-limited', title: 'Limited Series', genres: ['Drama', 'Mystery'] }),
  createRail({ id: 'shows-award', title: 'Award Winning', genres: ['Drama', 'Biography'] }),
  createRail({
    id: 'shows-new',
    title: 'New Episodes',
    genres: ['Drama', 'Comedy', 'Thriller'],
  }),
  createRail({ id: 'shows-cooking', title: 'Cooking Shows', genres: ['Cooking', 'Lifestyle'] }),
  createRail({ id: 'shows-travel', title: 'Travel', genres: ['Travel', 'Documentary'] }),
  createRail({ id: 'shows-history', title: 'History', genres: ['History', 'Documentary'] }),
  createRail({ id: 'shows-thriller', title: 'Thriller Series', genres: ['Thriller', 'Mystery'] }),
  createRail({ id: 'shows-classics', title: 'Timeless TV', genres: ['Drama', 'Comedy'] }),
]

export default { rails }
