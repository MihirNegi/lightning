import { createRail, createHeroSlides } from './contentFactory.js'

const hero = createHeroSlides({
  id: 'sports',
  slides: [
    {
      title: 'Championship Final',
      subtitle: 'Live This Weekend',
      description: 'The two best teams in the league meet for the ultimate showdown.',
    },
    {
      title: 'Golden Era',
      subtitle: 'Documentary Series',
      description: 'Relive the moments that defined a generation of athletes.',
    },
    {
      title: 'Rising Stars',
      subtitle: 'New Season',
      description: 'Follow the next wave of talent chasing their first title.',
    },
  ],
})

const rails = [
  createRail({ id: 'sports-live', title: 'Live Now', genres: ['Football', 'Cricket', 'Tennis'] }),
  createRail({ id: 'sports-highlights', title: 'Highlights', genres: ['Football', 'Cricket'] }),
  createRail({ id: 'sports-cricket', title: 'Cricket', genres: ['Cricket'] }),
  createRail({ id: 'sports-football', title: 'Football', genres: ['Football'] }),
  createRail({ id: 'sports-tennis', title: 'Tennis', genres: ['Tennis'] }),
  createRail({ id: 'sports-docs', title: 'Sports Documentaries', genres: ['Documentary'] }),
  createRail({ id: 'sports-basketball', title: 'Basketball', genres: ['Basketball'] }),
  createRail({ id: 'sports-motorsports', title: 'Motorsports', genres: ['Motorsports', 'Racing'] }),
  createRail({ id: 'sports-golf', title: 'Golf', genres: ['Golf'] }),
  createRail({ id: 'sports-boxing', title: 'Boxing & MMA', genres: ['Boxing', 'MMA'] }),
  createRail({
    id: 'sports-athletics',
    title: 'Athletics',
    genres: ['Athletics', 'Track & Field'],
  }),
  createRail({ id: 'sports-esports', title: 'eSports', genres: ['eSports', 'Gaming'] }),
  createRail({
    id: 'sports-classics',
    title: 'Classic Matches',
    genres: ['Football', 'Cricket', 'Tennis'],
  }),
  createRail({
    id: 'sports-analysis',
    title: 'Analysis & Talk Shows',
    genres: ['Talk Show', 'Analysis'],
  }),
  createRail({
    id: 'sports-upcoming',
    title: 'Upcoming Events',
    genres: ['Football', 'Cricket', 'Tennis'],
  }),
]

export default { hero, rails }
