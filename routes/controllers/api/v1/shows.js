const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');

module.exports = function (server) {
  console.log('* Show API Routes Loaded Into Server');
  const UserShow = require('../../../../db/models/userShow');

  // Search TV series by text
  server.get('/api/v1/shows/search/:search_param?/:page?', async (req, res) => {
    const parameters = {
      query: req.params.search_param || '',
      page: req.params.page || 1,
      include_adult: false
    };

    tmdService
      .searchTv(parameters)
      .then(async results => {
        try {
          // Filter out "non-series" types: Reality(10764), Talk(10767), News(10763)
          if (results && Array.isArray(results.results)) {
            results.results = results.results.filter(r => {
              const ids = Array.isArray(r && r.genre_ids) ? r.genre_ids : [];
              const notReality = !ids.includes(10764);
              const notTalk = !ids.includes(10767);
              const notNews = !ids.includes(10763);
              const notDoc = !ids.includes(99);
              // Also drop empty shells (no votes, no first_air_date)
              const hasDate = !!(r && r.first_air_date);
              const hasVotes = (r && Number(r.vote_count)) > 0;
              return notReality && notTalk && notNews && notDoc && hasDate && hasVotes;
            });
          }
          // Exclude award shows via keywords when we have them in our DB cache
          try {
            const ids = (results.results||[]).map(r => r && r.id).filter(Boolean).map(String);
            if (ids.length) {
              const docs = await Show.find({ tmd_id: { $in: ids } }).select('tmd_id keywords').lean();
              const kwMap = new Map(docs.map(d => [String(d.tmd_id), (d.keywords||[])]));
              results.results = (results.results||[]).filter(r => {
                const kws = kwMap.get(String(r.id)) || [];
                const text = kws.join(' ').toLowerCase();
                // conservative award-show detection
                const isAward = /award/.test(text) || /awards/.test(text) || /ceremony/.test(text);
                return !isAward;
              });
            }
          } catch(_){}

          if (String(req.query.hide_watched||'') === '1' && req.query.profile_id){
            const watchedDocs = await UserShow.find({ user_id: String(req.query.profile_id), $or: [ { show_watched_count: { $gt: 0 } }, { show_watched: { $ne: null } } ] }).select('show_id').lean();
            const watchedSet = new Set((watchedDocs||[]).map(d => String(d.show_id)));
            const filtered = Object.assign({}, results, { results: (results.results||[]).filter(r => !watchedSet.has(String(r.id))) });
            return res.send(filtered);
          }
        } catch(_){}
        res.send(results);
      })
      .catch(error => res.send(error));
  });

  // Search TV series by genre name
  server.get('/api/v1/shows/search_genre/:genre/:page?', async (req, res) => {
    try {
      const genres = await tmdService.genreTvList();
      let genre_id;
      (genres.genres || []).forEach(g => {
        if (String(req.params.genre).toLowerCase() === String(g.name || '').toLowerCase()) {
          genre_id = g.id;
        }
      });

      if (!genre_id) {
        return res.send({ page: 1, total_pages: 1, total_results: 0, results: [] });
      }

      const parameters = {
        with_genres: genre_id,
        page: req.params.page || 1,
        include_adult: false
      };

      tmdService
        .discoverTv(parameters)
      .then(async results => {
        try {
            if (results && Array.isArray(results.results)) {
              results.results = results.results.filter(r => {
                const ids = Array.isArray(r && r.genre_ids) ? r.genre_ids : [];
                const notReality = !ids.includes(10764);
                const notTalk = !ids.includes(10767);
                const notNews = !ids.includes(10763);
                const notDoc = !ids.includes(99);
                const hasDate = !!(r && r.first_air_date);
                const hasVotes = (r && Number(r.vote_count)) > 0;
                return notReality && notTalk && notNews && notDoc && hasDate && hasVotes;
              });
            }
            // Exclude award shows via keywords when known
            try {
              const ids = (results.results||[]).map(r => r && r.id).filter(Boolean).map(String);
              if (ids.length) {
                const docs = await Show.find({ tmd_id: { $in: ids } }).select('tmd_id keywords').lean();
                const kwMap = new Map(docs.map(d => [String(d.tmd_id), (d.keywords||[])]));
                results.results = (results.results||[]).filter(r => {
                  const kws = kwMap.get(String(r.id)) || [];
                  const text = kws.join(' ').toLowerCase();
                  const isAward = /award/.test(text) || /awards/.test(text) || /ceremony/.test(text);
                  return !isAward;
                });
              }
            } catch(_){}

            if (String(req.query.hide_watched||'') === '1' && req.query.profile_id){
              const watchedDocs = await UserShow.find({ user_id: String(req.query.profile_id), $or: [ { show_watched_count: { $gt: 0 } }, { show_watched: { $ne: null } } ] }).select('show_id').lean();
              const watchedSet = new Set((watchedDocs||[]).map(d => String(d.show_id)));
              const filtered = Object.assign({}, results, { results: (results.results||[]).filter(r => !watchedSet.has(String(r.id))) });
              return res.send(filtered);
            }
          } catch(_){}
          res.send(results);
        })
        .catch(error => res.send(error));
    } catch (e) {
      res.send({ page: 1, total_pages: 1, total_results: 0, results: [] });
    }
  });

  // Get poster path with caching to minimize TMDb calls
  const Show = require('../../../../db/models/show');
  const __posterCache = new Map();
  const POSTER_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
  function cacheGet(id){
    try { const v = __posterCache.get(String(id)); if (!v) return null; if ((Date.now() - (v.ts||0)) > POSTER_TTL_MS) { __posterCache.delete(String(id)); return null; } return v.path || null; } catch(_) { return null; }
  }
  function cachePut(id, path){ try { __posterCache.set(String(id), { path: path || null, ts: Date.now() }); } catch(_){} }

  server.get('/api/v1/shows/get_poster/:id', async (req, res) => {
    try {
      const id = String(req.params.id);
      const mem = cacheGet(id); if (mem) { res.set('Cache-Control','public, max-age=3600'); return res.send({ poster_path: mem }); }
      try {
        const doc = await Show.findOne({ tmd_id: id }).select('poster_path').lean();
        if (doc && doc.poster_path){ cachePut(id, doc.poster_path); res.set('Cache-Control','public, max-age=3600'); return res.send({ poster_path: doc.poster_path }); }
      } catch(_){}
      const show = await tmdService.tvInfo(id).catch(()=>({}));
      let poster = show && show.poster_path ? show.poster_path : null;
      // Enrich with keywords and metadata when available
      let keywords = [];
      try {
        const kw = await tmdService.tvKeywords({ id: id }).catch(()=>null);
        if (kw && Array.isArray(kw.results)) { keywords = kw.results.map(k => (k && (k.name||'')).toLowerCase()).filter(Boolean); }
      } catch(_){}
      cachePut(id, poster);
      try {
        const update = { poster_path: poster };
        try { if (show && Array.isArray(show.genres)) update.genres = show.genres.map(g=>g && g.id).filter(Boolean); } catch(_){}
        try { if (show && show.type) update.type = show.type; } catch(_){}
        if (keywords && keywords.length) update.keywords = keywords;
        await Show.updateOne({ tmd_id: id }, { $set: update }, { upsert: false });
      } catch(_){}
      res.set('Cache-Control','public, max-age=1800');
      return res.send({ poster_path: poster });
    } catch (e) { return res.send({ poster_path: null }); }
  });
};
