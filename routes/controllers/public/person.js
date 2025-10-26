const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');

module.exports = function (server) {
  console.log('* Person Routes Loaded Into Server');

  server.get('/person/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const [info, movieCredits, tvCredits] = await Promise.all([
        tmdService.personInfo(id).catch(()=>({})),
        tmdService.personMovieCredits(id).catch(()=>({ cast: [], crew: [] })),
        tmdService.personTvCredits(id).catch(()=>({ cast: [], crew: [] })),
      ]);

      const castMovies = (movieCredits.cast||[])
        .filter(m => (m && m.release_date) && Number(m.vote_count||0) > 0)
        .sort((a,b)=> (b.popularity||0)-(a.popularity||0));
      const castShows = (tvCredits.cast||[])
        .filter(s => {
          const ids = Array.isArray(s && s.genre_ids) ? s.genre_ids : [];
          const notReality = !ids.includes(10764);
          const hasDate = !!(s && s.first_air_date);
          const hasVotes = Number(s && s.vote_count || 0) > 0;
          return notReality && hasDate && hasVotes;
        })
        .sort((a,b)=> (b.popularity||0)-(a.popularity||0));
      const crewMovies = (movieCredits.crew||[])
        .filter(c=>c.job==='Director' && (c && c.release_date) && Number(c.vote_count||0) > 0);
      const crewShows = (tvCredits.crew||[])
        .filter(s => {
          const ids = Array.isArray(s && s.genre_ids) ? s.genre_ids : [];
          const notReality = !ids.includes(10764);
          const hasDate = !!(s && s.first_air_date);
          const hasVotes = Number(s && s.vote_count || 0) > 0;
          return notReality && hasDate && hasVotes;
        });

      res.render('public assets/template.ejs', {
        page_title: `iWatched - ${info && (info.name||'Person')}`,
        page_file: 'person',
        page_data: {
          person: info,
          cast_movies: castMovies,
          cast_shows: castShows,
          crew_movies: crewMovies,
          crew_shows: crewShows
        },
        user: req.user
      });
    } catch (e) {
      res.status(500).send('Failed to load person');
    }
  });
}
