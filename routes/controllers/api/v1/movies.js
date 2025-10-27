const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da')

module.exports = function (server) {
    console.log('* Movie Routes Loaded Into Server');

    const UserMovie = require('../../../../db/models/userMovie');

    server.get('/api/v1/movies/search/:search_param?/:page?', async (req, res) => {
        const parameters = {
            query: req.params.search_param || "",
            page: req.params.page || 1,
            include_adult: false
        }

        tmdService
            .searchMovie(parameters)
            .then(async results => {
                try {
                    // Filter out rumored/unreleased-ish items from search results
                    // TMDb search response does not include status; approximate by
                    // requiring a release_date and some voting activity.
                    if (results && Array.isArray(results.results)) {
                        results.results = results.results.filter(r => {
                            const hasDate = !!(r && r.release_date);
                            const hasVotes = (r && Number(r.vote_count)) > 0;
                            return hasDate && hasVotes;
                        });
                    }
                    if (String(req.query.hide_watched||'') === '1' && req.query.profile_id) {
                        const watchedDocs = await UserMovie.find({ user_id: String(req.query.profile_id), $or: [ { movie_watched_count: { $gt: 0 } }, { movie_watched: { $ne: null } } ] }).select('movie_id').lean();
                        const watchedSet = new Set((watchedDocs||[]).map(d => String(d.movie_id)));
                        const filtered = Object.assign({}, results, { results: (results.results||[]).filter(r => !watchedSet.has(String(r.id))) });
                        return res.send(filtered);
                    }
                } catch(_){}
                res.send(results)
            })
            .catch(error => {
                res.send(error)
            })
    });

    server.get('/api/v1/movies/search_genre/:genre/:page?', async (req, res) => {
        let genres = await tmdService.genreMovieList();
        let genre_id
        genres.genres.forEach(genre => {
            if (req.params.genre.toString() == genre.name.toLowerCase())
                genre_id = genre.id
        });

        const parameters = {
            id: genre_id,
            page: req.params.page || 1,
            include_adult: false
        }

        tmdService
            .genreMovies(parameters)
            .then(async results => {
                try {
                    // Filter out rumored/unreleased-ish items
                    if (results && Array.isArray(results.results)) {
                        results.results = results.results.filter(r => {
                            const hasDate = !!(r && r.release_date);
                            const hasVotes = (r && Number(r.vote_count)) > 0;
                            return hasDate && hasVotes;
                        });
                    }
                    if (String(req.query.hide_watched||'') === '1' && req.query.profile_id) {
                        const watchedDocs = await UserMovie.find({ user_id: String(req.query.profile_id), $or: [ { movie_watched_count: { $gt: 0 } }, { movie_watched: { $ne: null } } ] }).select('movie_id').lean();
                        const watchedSet = new Set((watchedDocs||[]).map(d => String(d.movie_id)));
                        const filtered = Object.assign({}, results, { results: (results.results||[]).filter(r => !watchedSet.has(String(r.id))) });
                        return res.send(filtered);
                    }
                } catch(_){}
                res.send(results)
            })
            .catch(error => {
                res.send(error)
            })
    });

    // Lightweight poster cache to minimize TMDb calls
    const Movie = require('../../../../db/models/movie');
    const __posterCache = new Map(); // key -> { path, ts }
    const POSTER_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
    function cacheGet(id){
        try { const v = __posterCache.get(String(id)); if (!v) return null; if ((Date.now() - (v.ts||0)) > POSTER_TTL_MS) { __posterCache.delete(String(id)); return null; } return v.path || null; } catch(_) { return null; }
    }
    function cachePut(id, path){ try { __posterCache.set(String(id), { path: path || null, ts: Date.now() }); } catch(_){} }

    server.get('/api/v1/movies/get_poster/:id', async (req, res) => {
        try {
            const id = String(req.params.id);
            // 1) Memory cache
            const mem = cacheGet(id); if (mem) { res.set('Cache-Control','public, max-age=3600'); return res.send({ poster_path: mem }); }
            // 2) DB cache (Movie document)
            try {
                const doc = await Movie.findOne({ tmd_id: id }).select('poster_path').lean();
                if (doc && doc.poster_path){ cachePut(id, doc.poster_path); res.set('Cache-Control','public, max-age=3600'); return res.send({ poster_path: doc.poster_path }); }
            } catch(_){}
            // 3) Fallback to TMDb, persist
            const movie = await tmdService.movieInfo(id).catch(()=>({}));
            const poster = movie && movie.poster_path ? movie.poster_path : null;
            cachePut(id, poster);
            try { if (poster) { await Movie.updateOne({ tmd_id: id }, { $set: { poster_path: poster } }, { upsert: false }); } } catch(_){}
            res.set('Cache-Control','public, max-age=1800');
            return res.send({ poster_path: poster });
        } catch (_) { return res.send({ poster_path: null }); }
    });
}
