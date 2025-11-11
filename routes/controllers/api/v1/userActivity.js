const User = require('../../../../db/models/user');
const UserMovie = require('../../../../db/models/userMovie');
const UserShow = require('../../../../db/models/userShow');
const Movie = require('../../../../db/models/movie');
const Show = require('../../../../db/models/show');

module.exports = (server) => {
  console.log('* UserActivity Routes Loaded Into Server');

  // Latest activity (movies + shows) with optional type filter and limit
  // Query params:
  //   - limit: number of items to return (default 12, max 60)
  //   - type: 'movie' | 'show' (optional)
  server.get('/api/v1/user-activity/latest/:profile_id', async (req, res) => {
    try {
      const user = await User.findById(req.params.profile_id).lean();
      if (!user) return res.status(404).send({ status: 404, message: 'No user found' });
      let limit = parseInt(req.query.limit, 10); if (!isFinite(limit) || limit <= 0) limit = 12; limit = Math.min(60, Math.max(1, limit));
      const typeFilter = (req.query.type === 'movie' || req.query.type === 'show') ? String(req.query.type) : null;

      const [mDocs, sDocs] = await Promise.all([
        UserMovie.find({ user_id: user._id, $or: [
          { movie_watched_count: { $gt: 0 } }, { movie_watched: { $ne: null } },
          { movie_bookmarked: { $ne: null } }, { movie_favorite: { $ne: null } }
        ] }).select('movie_id movie_watched movie_bookmarked movie_favorite date_updated').lean(),
        UserShow.find({ user_id: user._id, $or: [
          { show_watched_count: { $gt: 0 } }, { show_watched: { $ne: null } },
          { show_bookmarked: { $ne: null } }, { show_favorite: { $ne: null } },
          { seasons: { $elemMatch: { date_completed: { $ne: null } } } }
        ] }).select('show_id show_watched show_bookmarked show_favorite seasons.date_completed date_updated').lean()
      ]);

      function maxDate() {
        let best = 0; for (let i=0;i<arguments.length;i++){ const v = arguments[i]; if (!v) continue; const t = new Date(v).getTime(); if (isFinite(t) && t > best) best = t; } return best;
      }

      const mActs = (mDocs||[]).map(d => ({
        type: 'movie', id: String(d.movie_id),
        ts: maxDate(d.movie_watched, d.movie_bookmarked, d.movie_favorite, d.date_updated),
        w: !!(((d.movie_watched_count||0) > 0) || d.movie_watched),
        f: !!d.movie_favorite,
        s: !!d.movie_bookmarked
      })).filter(a => a.ts>0);
      const sActs = (sDocs||[]).map(d => {
        let seasonMax = 0;
        try { const arr = (d.seasons||[]).map(s => s && s.date_completed); seasonMax = maxDate.apply(null, arr); } catch(_){}
        const watched = !!(((d.show_watched_count||0) > 0) || d.show_watched || seasonMax);
        return { type: 'show', id: String(d.show_id), ts: maxDate(d.show_watched, d.show_bookmarked, d.show_favorite, seasonMax, d.date_updated), w: watched, f: !!d.show_favorite, s: !!d.show_bookmarked };
      }).filter(a => a.ts>0);

      let combined = mActs.concat(sActs);
      if (typeFilter) combined = combined.filter(x => x && x.type === typeFilter);
      combined.sort((a,b)=> b.ts - a.ts);
      const top = combined.slice(0, limit);

      const movieIds = top.filter(x=>x.type==='movie').map(x=>x.id);
      const showIds = top.filter(x=>x.type==='show').map(x=>x.id);
      const [movies, shows] = await Promise.all([
        movieIds.length ? Movie.find({ 'tmd_id': { $in: movieIds } }).select('tmd_id movie_title poster_path').lean() : Promise.resolve([]),
        showIds.length ? Show.find({ 'tmd_id': { $in: showIds } }).select('tmd_id show_title poster_path').lean() : Promise.resolve([])
      ]);
      const mMap = new Map((movies||[]).map(m => [String(m.tmd_id), m]));
      const sMap = new Map((shows||[]).map(s => [String(s.tmd_id), s]));

      const results = top.map(x => {
        if (x.type === 'movie'){
          const m = mMap.get(x.id) || {}; return { type:'movie', tmd_id: x.id, movie_title: m.movie_title || '', poster_path: m.poster_path || null, w: !!x.w, f: !!x.f, s: !!x.s };
        } else {
          const s = sMap.get(x.id) || {}; return { type:'show', tmd_id: x.id, show_title: s.show_title || '', poster_path: s.poster_path || null, w: !!x.w, f: !!x.f, s: !!x.s };
        }
      });

      return res.send({ user_id: user._id, amount_of_results: results.length, results });
    } catch (e) { return res.status(400).send({ status: 400 }); }
  });
}
