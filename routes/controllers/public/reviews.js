const Review = require('../../../db/models/review');
const getUser = require('../../middleware/getUser');
const enforceProfileVisibility = require('../../middleware/enforceProfileVisibility');
let tmdService = null;
try {
  const MovieDb = require('moviedb-promise');
  tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');
} catch (_) { tmdService = null; }

function slugify(str){
  if(!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80);
}

module.exports = function(server){
  console.log('* User Reviews Routes Loaded Into Server');

  // Pretty profile route: /:id/reviews (id or custom_url)
  server.get('/:id/reviews', getUser, enforceProfileVisibility, async function(req, res){
    try {
      const owner = res.locals.user;
      if (!owner) {
        return res.status(404).render('public assets/template.ejs', { page_title: 'User not found', page_file: 'error', page_data: { error: { status: 404, message: 'User not found' } }, user: req.user });
      }
      const userId = owner._id;
      const list = await Review.find({ author_id: userId, deleted: { $ne: true } }).sort({ created_at: -1 }).limit(500).lean();

      async function enrichOne(r){
        const id = r && r.item_id; const type = r && r.item_type;
        let link = '#', title = type === 'movie' ? 'Movie' : 'Show', poster = null;
        try {
          if (tmdService) {
            if (type === 'movie'){
              const m = await tmdService.movieInfo({ id: id }).catch(()=>null);
              if (m) { title = m.title || m.name || 'Movie'; poster = m.poster_path || null; link = '/movies/' + id + '-' + slugify(title); }
            } else if (type === 'show'){
              const s = await tmdService.tvInfo({ id: id }).catch(()=>null);
              if (s) { title = s.name || s.title || 'Show'; poster = s.poster_path || null; link = '/shows/' + id + '-' + slugify(title); }
            }
          }
        } catch(_){}
        if (link === '#') link = (type === 'movie') ? ('/movies/' + id) : ('/shows/' + id);
        r._item = { title, link, poster };
        return r;
      }

      let enriched = list;
      try {
        const limited = list.slice(0, 60);
        const head = await Promise.all(limited.map(enrichOne));
        enriched = head.concat(list.slice(limited.length));
      } catch(_){}

      // Build header stats to match profile layout
      let header = { numberOfMoviesWatched: 0, movie_watch_time: '-', numberOfShowsWatched: 0, numberOfSeasonsWatched: 0, numberOfEpisodesWatched: 0, show_watch_time: '-', total_watch_time_text: '-' };
      try {
        const UserMovieTotals = require('../../../db/models/userMovieTotals');
        const UserMovie = require('../../../db/models/userMovie');
        const UserShowTotals = require('../../../db/models/userShowTotals');
        function minsToText(mins){ mins = Math.max(0, Math.floor(Number(mins||0))); const d=Math.floor(mins/1440); const h=Math.floor((mins%1440)/60); const m=mins%60; return d+" "+(d===1?"day":"days")+" and "+h+" "+(h===1?"hour":"hours")+" and "+m+" minutes"; }
        const mt = await UserMovieTotals.findOne({ user_id: userId }).lean();
        const st = await UserShowTotals.findOne({ user_id: userId }).lean();
        const moviesCount = await UserMovie.countDocuments({ user_id: userId, movie_watched_count: { $gt: 0 } });
        const movieMins = (mt && typeof mt.total_runtime==='number') ? mt.total_runtime : 0;
        const showMins = (st && typeof st.total_runtime==='number') ? st.total_runtime : 0;
        header = {
          numberOfMoviesWatched: moviesCount,
          movie_watch_time: movieMins ? minsToText(movieMins) : '-',
          numberOfShowsWatched: (st && st.unique_shows_watched) || 0,
          numberOfSeasonsWatched: (st && st.total_seasons_watched) || 0,
          numberOfEpisodesWatched: (st && st.total_episodes_watched) || 0,
          show_watch_time: showMins ? minsToText(showMins) : '-',
          total_watch_time_text: minsToText((movieMins||0)+(showMins||0))
        };
      } catch(_){}

      res.render('public assets/template.ejs', {
        page_title: 'iWatched - Reviews',
        page_file: 'profile',
        page_subFile: 'reviews',
        page_data: Object.assign({ user: owner, items: enriched }, header),
        user: req.user
      });
    } catch (e) {
      res.render('public assets/template.ejs', { page_title: 'iWatched - Reviews', page_file: 'profile', page_subFile: 'reviews', page_data: { user: res.locals.user, items: [] }, user: req.user });
    }
  });

  // Convenience route to own reviews (kept for backwards-compat): /user/reviews
  server.get('/user/reviews', async function(req, res){
    try {
      if (!req.user) return res.redirect('/login');
      const userId = req.user._id;
      const list = await Review.find({ author_id: userId, deleted: { $ne: true } }).sort({ created_at: -1 }).limit(500).lean();
      let enriched = list; try { const limited = list.slice(0,60); const head = await Promise.all(limited.map(async (r)=>{ return (await (async function enrichOne(r){ const id=r&&r.item_id; const type=r&&r.item_type; let link='#',title=type==='movie'?'Movie':'Show',poster=null; try{ if(tmdService){ if(type==='movie'){ const m=await tmdService.movieInfo({ id }).catch(()=>null); if(m){ title=m.title||m.name||'Movie'; poster=m.poster_path||null; link='/movies/'+id+'-'+slugify(title); } } else if(type==='show'){ const s=await tmdService.tvInfo({ id }).catch(()=>null); if(s){ title=s.name||s.title||'Show'; poster=s.poster_path||null; link='/shows/'+id+'-'+slugify(title); } } } }catch(_){} if(link==='#') link=(type==='movie')?('/movies/'+id):('/shows/'+id); r._item={ title, link, poster }; return r; })(r)); })); enriched=head.concat(list.slice(limited.length)); } catch(_){}
      res.render('public assets/template.ejs', { page_title: 'iWatched - My Reviews', page_file: 'reviews', page_subFile: 'main', page_data: { items: enriched, owner: { _id: String(userId) } }, user: req.user });
    } catch(_) {
      res.render('public assets/template.ejs', { page_title: 'iWatched - My Reviews', page_file: 'reviews', page_subFile: 'main', page_data: { items: [], owner: null }, user: req.user });
    }
  });
}
