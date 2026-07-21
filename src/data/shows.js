import { createRail, createHeroSlides } from './contentFactory.js'

const hero = createHeroSlides({
  id: 'shows',
  slides: [
    {
      title: 'Crimson Kingdom',
      subtitle: 'Season 3 Premiere',
      description: 'A ruthless dynasty faces its greatest threat yet — from within.',
    },
    {
      title: 'Hidden Legacy',
      subtitle: 'Limited Series',
      description: 'Two siblings unravel a century-old family secret hiding in plain sight.',
    },
    {
      title: 'Broken Empire',
      subtitle: 'New Episodes Weekly',
      description: 'A once-great city struggles to rebuild after a mysterious catastrophe.',
    },
  ],
})

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
]

export default { hero, rails }
