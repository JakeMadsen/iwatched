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

      const castMovies = (movieCredits.cast||[]).sort((a,b)=> (b.popularity||0)-(a.popularity||0));
      const castShows = (tvCredits.cast||[]).sort((a,b)=> (b.popularity||0)-(a.popularity||0));
      const crewMovies = (movieCredits.crew||[]).filter(c=>c.job==='Director');
      const crewShows = (tvCredits.crew||[]);

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

