const Recommendation = require('../../../db/models/recommendation');
const User = require('../../../db/models/user');
const getUser = require('../../middleware/getUser');
const isCorrectUser = require('../../middleware/isCorrectUser');
// Create TMDB client only if a valid key is present to avoid crashing
let tmdService = null;
try {
  const MovieDb = require('moviedb-promise');
  // Match rest of app behavior: use fallback demo key when .env missing
  tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');
} catch (_) { tmdService = null; }

module.exports = function(server){
  console.log('* Recommendations Routes Loaded Into Server');

  server.get('/user/recommendations', async function(req, res){
    try {
      if (!req.user) {
        return res.redirect('/login');
      }
      const userId = req.user._id;
      // Basic lists
      const [sent, received] = await Promise.all([
        Recommendation.find({ sender_id: userId, is_deleted: { $ne: true } }).sort({ date_updated: -1 }).limit(200).lean(),
        Recommendation.find({ receiver_id: userId, is_deleted: { $ne: true } }).sort({ date_updated: -1 }).limit(200).lean()
      ]);

      // Build user lookup for names/avatars
      const userIds = new Set();
      sent.forEach(r => { if (r.sender_id) userIds.add(String(r.sender_id)); if (r.receiver_id) userIds.add(String(r.receiver_id)); });
      received.forEach(r => { if (r.sender_id) userIds.add(String(r.sender_id)); if (r.receiver_id) userIds.add(String(r.receiver_id)); });
      let people = [];
      try { people = await User.find({ _id: { $in: Array.from(userIds) } }).lean(); } catch(_) { people = []; }
      const nameMap = new Map(people.map(u => [String(u._id), (u.local && u.local.username) || (u.profile && u.profile.custom_url) || 'user']));

      // Enrich with TMDB titles/posters (best-effort). If no API key, provide minimal links.
      async function enrichOne(rec){
        const id = rec && rec.content_id; const type = rec && rec.content_type;
        try {
          if (tmdService) {
            if (type === 'movie'){
              const m = await tmdService.movieInfo({ id }).catch(()=>null);
              if (m) rec._content = { title: m.title || m.name || 'Movie', poster: m.poster_path || null, tagline: m.tagline || '', url: '/movies/' + id + '-' + slugify(m.title||m.name||'') };
            } else if (type === 'show'){
              const s = await tmdService.tvInfo({ id }).catch(()=>null);
              if (s) rec._content = { title: s.name || s.title || 'Show', poster: s.poster_path || null, tagline: s.tagline || '', url: '/shows/' + id + '-' + slugify(s.name||'') };
            }
          }
        } catch(_){}
        // Minimal fallback if enrichment was not possible
        if (!rec._content){
          if (type === 'movie') rec._content = { title: 'Movie', poster: null, tagline: '', url: '/movies/' + id };
          else if (type === 'show') rec._content = { title: 'Show', poster: null, tagline: '', url: '/shows/' + id };
        }
        rec._sender_name = nameMap.get(String(rec.sender_id)) || 'user';
        rec._receiver_name = nameMap.get(String(rec.receiver_id)) || 'user';
        return rec;
      }

      async function enrich(list){
        const chunks = list || [];
        const limited = chunks.slice(0, 60); // avoid too many API calls
        const enriched = await Promise.all(limited.map(enrichOne));
        // keep order and append any overflow (without enrichment)
        return enriched.concat((chunks||[]).slice(limited.length));
      }

      const [sentEnriched, receivedEnriched] = await Promise.all([enrich(sent), enrich(received)]);
      // Mark notifications as seen when page is opened
      try { await Recommendation.updateMany({ receiver_id: userId, receiver_notified: { $ne: true } }, { $set: { receiver_notified: true } }); } catch(_){}

      // Build lightweight header stats for profile header/quicklinks on this page
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
        page_title: 'iWatched.xyz - Recommendations',
        page_file: 'recommendations',
        page_subFile: 'main',
        page_data: Object.assign({
          user: req.user,
          sent: sentEnriched,
          received: receivedEnriched
        }, header),
        user: req.user
      });
    } catch (e) {
      res.render('public assets/template.ejs', { page_title: 'Recommendations', page_file: 'recommendations', page_subFile: 'main', page_data: { sent: [], received: [], error: true }, user: req.user });
    }
  });

  // Username-style route, e.g. /JakeTheDane/recommendations
  server.get('/:id/recommendations', getUser, isCorrectUser, async function(req, res){
    try {
      if (!res.locals.user) return res.redirect('/login');
      const userId = res.locals.user._id;
      const [sent, received] = await Promise.all([
        Recommendation.find({ sender_id: userId, is_deleted: { $ne: true } }).sort({ date_updated: -1 }).limit(200).lean(),
        Recommendation.find({ receiver_id: userId, is_deleted: { $ne: true } }).sort({ date_updated: -1 }).limit(200).lean()
      ]);

      const userIds = new Set();
      sent.forEach(r => { if (r.sender_id) userIds.add(String(r.sender_id)); if (r.receiver_id) userIds.add(String(r.receiver_id)); });
      received.forEach(r => { if (r.sender_id) userIds.add(String(r.sender_id)); if (r.receiver_id) userIds.add(String(r.receiver_id)); });
      let people = [];
      try { people = await User.find({ _id: { $in: Array.from(userIds) } }).lean(); } catch(_) { people = []; }
      const nameMap = new Map(people.map(u => [String(u._id), (u.local && u.local.username) || (u.profile && u.profile.custom_url) || 'user']));

      async function enrichOne(rec){
        const id = rec && rec.content_id; const type = rec && rec.content_type;
        try {
          if (tmdService) {
            if (type === 'movie'){
              const m = await tmdService.movieInfo({ id }).catch(()=>null);
              if (m) rec._content = { title: m.title || m.name || 'Movie', poster: m.poster_path || null, url: '/movies/' + id + '-' + slugify(m.title||m.name||'') };
            } else if (type === 'show'){
              const s = await tmdService.tvInfo({ id }).catch(()=>null);
              if (s) rec._content = { title: s.name || s.title || 'Show', poster: s.poster_path || null, url: '/shows/' + id + '-' + slugify(s.name||'') };
            }
          }
        } catch(_){}
        if (!rec._content){
          if (type === 'movie') rec._content = { title: 'Movie', poster: null, url: '/movies/' + id };
          else if (type === 'show') rec._content = { title: 'Show', poster: null, url: '/shows/' + id };
        }
        rec._sender_name = nameMap.get(String(rec.sender_id)) || 'user';
        rec._receiver_name = nameMap.get(String(rec.receiver_id)) || 'user';
        return rec;
      }

      async function enrich(list){
        const chunks = list || [];
        const limited = chunks.slice(0, 60);
        const enriched = await Promise.all(limited.map(enrichOne));
        return enriched.concat((chunks||[]).slice(limited.length));
      }

      const [sentEnriched, receivedEnriched] = await Promise.all([enrich(sent), enrich(received)]);
      try { await Recommendation.updateMany({ receiver_id: userId, receiver_notified: { $ne: true } }, { $set: { receiver_notified: true } }); } catch(_){}

      // Build header stats for profile header/quicklinks
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
        page_title: 'iWatched.xyz - Recommendations',
        page_file: 'recommendations',
        page_subFile: 'main',
        page_data: Object.assign({ sent: sentEnriched, received: receivedEnriched, user: res.locals.user }, header),
        user: req.user
      });
    } catch (e) {
      res.render('public assets/template.ejs', { page_title: 'Recommendations', page_file: 'recommendations', page_subFile: 'main', page_data: { sent: [], received: [] }, user: req.user });
    }
  });
}

function slugify(str){
  if(!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80);
}
