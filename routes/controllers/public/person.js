const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');
const Show = require('../../../db/models/show');

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

      // Build a keyword/type map for shows we already have cached locally
      let kwMap = new Map();
      try {
        const allShowIds = Array.from(new Set([
          ...((tvCredits.cast||[]).map(s=>String(s && s.id)).filter(Boolean)),
          ...((tvCredits.crew||[]).map(s=>String(s && s.id)).filter(Boolean))
        ]));
        if (allShowIds.length){
          const docs = await Show.find({ tmd_id: { $in: allShowIds } }).select('tmd_id keywords type genres').lean();
          kwMap = new Map(docs.map(d => [String(d.tmd_id), d]));
        }
      } catch(_){}

      function isAwardShow(name, id){
        try {
          const nm = String(name||'').toLowerCase();
          if (/\b(awards?|ceremony|oscars?|academy\s+awards?|golden\s+globes?|emmys?|grammys?|bafta|sag\s+awards?|scream\s+awards?)\b/i.test(nm)) return true;
          const d = kwMap.get(String(id));
          if (d && Array.isArray(d.keywords)){
            const text = d.keywords.join(' ').toLowerCase();
            if (/\b(awards?|ceremony|oscars?|academy\s+awards?|golden\s+globes?|emmys?|grammys?|bafta|sag\s+awards?|scream\s+awards?)\b/i.test(text)) return true;
          }
        } catch(_){}
        return false;
      }

      const castMovies = (movieCredits.cast||[])
        .filter(m => {
          const hasDate = (m && m.release_date);
          const hasVotes = Number(m && m.vote_count || 0) > 0;
          const ids = Array.isArray(m && m.genre_ids) ? m.genre_ids : [];
          const notDoc = !ids.includes(99);
          return notDoc && hasDate && hasVotes;
        })
        .sort((a,b)=> (b.popularity||0)-(a.popularity||0));
      const castShows = (tvCredits.cast||[])
        .filter(s => {
          const ids = Array.isArray(s && s.genre_ids) ? s.genre_ids : [];
          const notReality = !ids.includes(10764);
          const notTalk = !ids.includes(10767);
          const notNews = !ids.includes(10763);
          const notDoc = !ids.includes(99);
          const hasDate = !!(s && s.first_air_date);
          const hasVotes = Number(s && s.vote_count || 0) > 0;
          if (!(notReality && notTalk && notNews && notDoc && hasDate && hasVotes)) return false;
          return !isAwardShow(s && s.name, s && s.id);
        })
        .sort((a,b)=> (b.popularity||0)-(a.popularity||0));
      const crewMovies = (movieCredits.crew||[])
        .filter(c=>{
          if (c.job!=='Director') return false;
          const hasDate = (c && c.release_date);
          const hasVotes = Number(c && c.vote_count || 0) > 0;
          const ids = Array.isArray(c && c.genre_ids) ? c.genre_ids : [];
          const notDoc = !ids.includes(99);
          return notDoc && hasDate && hasVotes;
        });
      const crewShows = (tvCredits.crew||[])
        .filter(s => {
          const ids = Array.isArray(s && s.genre_ids) ? s.genre_ids : [];
          const notReality = !ids.includes(10764);
          const notTalk = !ids.includes(10767);
          const notNews = !ids.includes(10763);
          const notDoc = !ids.includes(99);
          const hasDate = !!(s && s.first_air_date);
          const hasVotes = Number(s && s.vote_count || 0) > 0;
          if (!(notReality && notTalk && notNews && notDoc && hasDate && hasVotes)) return false;
          return !isAwardShow(s && s.name, s && s.id);
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
