/*
*   Mongoose models
**************************/
const User = require('../../../../db/models/user');
const Movie = require('../../../../db/models/movie');
const UserMovie = require('../../../../db/models/userMovie');
const UserMovieTotals = require('../../../../db/models/userMovieTotals');

/*
*   Services
**************************/
const apiIsCorrectUser = require('../../../middleware/apiIsCorrectUser');
const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');
const paginateArray = require('../../../services/paginateArray');
const movieService = require('../../../services/movies');
const createError = require('http-errors');

async function ensureMovieInDb(tmdbId){
    try {
        const found = await Movie.findOne({ 'tmd_id': String(tmdbId) }).lean();
        if (found) return found;
        const movieInfo = await tmdService.movieInfo(tmdbId);
        let m = new Movie();
        m.initial(movieInfo);
        await m.save();
        return m.toObject();
    } catch (_) { return null; }
}

async function getOrCreateTotals(user_id){
    let totals = await UserMovieTotals.findOne({ user_id });
    if (!totals){
        totals = new UserMovieTotals(); totals.initial(user_id); await totals.save();
    }
    return totals;
}

function isMovieDocEmpty(doc){
    if (!doc) return true;
    const noCounts = ((doc.movie_watched_count||0) === 0) && !doc.movie_watched;
    const noFlags = !doc.movie_bookmarked && !doc.movie_favorite;
    const noPersonal = !(doc.personal_note && String(doc.personal_note).trim()) && ((Number(doc.personal_rating)||0) === 0);
    return noCounts && noFlags && noPersonal;
}

module.exports = (server) => {
    console.log('* UserMovies Routes Loaded Into Server');

    // Add one watch instance for a movie
    server.post('/api/v1/user-movies/watch/add', apiIsCorrectUser, async (req, res) => {
        try {
            const user_id = req.body.user_id;
            const movie_id = String(req.body.movie_id);
            if (!user_id || !movie_id) return res.status(400).send({ status: 400, message: 'Missing user_id or movie_id' });

            // ensure Movie exists
            const info = await tmdService.movieInfo(movie_id).catch(()=>({ runtime: 0 }));
            await ensureMovieInDb(movie_id);
            const runtime = Number(req.body.movie_runtime || info.runtime || 0) || 0;

            // upsert user-movie doc
            let doc = await UserMovie.findOne({ user_id, movie_id });
            const first = !doc || (doc.movie_watched_count || 0) === 0;
            if (!doc){ doc = new UserMovie(); doc.initial(user_id, movie_id); }
            doc.markWatched(runtime);
            await doc.save();

            const totals = await getOrCreateTotals(user_id);
            totals.incWatch(first, runtime);
            await totals.save();

            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Remove one watch instance for a movie
    server.post('/api/v1/user-movies/watch/remove', apiIsCorrectUser, async (req, res) => {
        try {
            const user_id = req.body.user_id; const movie_id = String(req.body.movie_id);
            if (!user_id || !movie_id) return res.status(400).send({ status: 400 });
            const runtime = Number(req.body.movie_runtime) || await movieService.getMoveRuntimeIfNull(movie_id).catch(()=>0) || 0;
            const doc = await UserMovie.findOne({ user_id, movie_id });
            if (!doc) return res.status(404).send({ status: 404, message: 'Entry not found' });
            const last = (doc.movie_watched_count || 0) === 1;
            doc.unwatchOnce(runtime); await doc.save();
            const totals = await getOrCreateTotals(user_id);
            totals.decWatch(last, runtime); await totals.save();
            // Clean up if document is now empty (accidental clicks)
            try { const fresh = await UserMovie.findById(doc._id).lean(); if (isMovieDocEmpty(fresh)) { await UserMovie.deleteOne({ _id: doc._id }); } } catch(_){}
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Bookmark add/remove
    server.post('/api/v1/user-movies/bookmark/add', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id, movie_id } = req.body; if (!user_id || !movie_id) return res.status(400).send({ status: 400 });
            await ensureMovieInDb(movie_id);
            let doc = await UserMovie.findOne({ user_id, movie_id: String(movie_id) });
            if (!doc){ doc = new UserMovie(); doc.initial(user_id, movie_id); }
            doc.setBookmarked(true); await doc.save();
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });
    server.post('/api/v1/user-movies/bookmark/remove', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id, movie_id } = req.body; if (!user_id || !movie_id) return res.status(400).send({ status: 400 });
            const doc = await UserMovie.findOne({ user_id, movie_id: String(movie_id) });
            if (!doc) return res.status(404).send({ status: 404 });
            doc.setBookmarked(false); await doc.save();
            try { const fresh = await UserMovie.findById(doc._id).lean(); if (isMovieDocEmpty(fresh)) { await UserMovie.deleteOne({ _id: doc._id }); } } catch(_){}
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Favourite add/remove
    server.post('/api/v1/user-movies/favourited/add', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id, movie_id } = req.body; if (!user_id || !movie_id) return res.status(400).send({ status: 400 });
            await ensureMovieInDb(movie_id);
            let doc = await UserMovie.findOne({ user_id, movie_id: String(movie_id) });
            if (!doc){ doc = new UserMovie(); doc.initial(user_id, movie_id); }
            doc.setFavourited(true); await doc.save();
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });
    server.post('/api/v1/user-movies/favourited/remove', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id, movie_id } = req.body; if (!user_id || !movie_id) return res.status(400).send({ status: 400 });
            const doc = await UserMovie.findOne({ user_id, movie_id: String(movie_id) });
            if (!doc) return res.status(404).send({ status: 404 });
            doc.setFavourited(false); await doc.save();
            try { const fresh = await UserMovie.findById(doc._id).lean(); if (isMovieDocEmpty(fresh)) { await UserMovie.deleteOne({ _id: doc._id }); } } catch(_){}
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Note & Rating
    server.post('/api/v1/user-movies/note/set', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id, movie_id, personal_note } = req.body; if (!user_id || !movie_id) return res.status(400).send({ status: 400 });
            let doc = await UserMovie.findOne({ user_id, movie_id: String(movie_id) });
            if (!doc){ doc = new UserMovie(); doc.initial(user_id, movie_id); }
            doc.setNote(personal_note || ""); await doc.save();
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });
    server.post('/api/v1/user-movies/rating/set', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id, movie_id, personal_rating } = req.body; if (!user_id || !movie_id) return res.status(400).send({ status: 400 });
            let doc = await UserMovie.findOne({ user_id, movie_id: String(movie_id) });
            if (!doc){ doc = new UserMovie(); doc.initial(user_id, movie_id); }
            doc.setRating(personal_rating); await doc.save();
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Checks
    server.get('/api/v1/user-movies/check/watched/:profile_id/:movie_id', async (req, res) => {
        try {
            const doc = await UserMovie.findOne({ user_id: req.params.profile_id, movie_id: String(req.params.movie_id) }).lean();
            const exists = !!(doc && (doc.movie_watched_count || 0) > 0);
            res.send(exists);
        } catch (e) { res.send(false); }
    });
    server.get('/api/v1/user-movies/check/favourited/:profile_id/:movie_id', async (req, res) => {
        try {
            const doc = await UserMovie.findOne({ user_id: req.params.profile_id, movie_id: String(req.params.movie_id) }).lean();
            const exists = !!(doc && !!doc.movie_favorite);
            res.send(exists);
        } catch (e) { res.send(false); }
    });
    server.get('/api/v1/user-movies/check/saved/:profile_id/:movie_id', async (req, res) => {
        try {
            const doc = await UserMovie.findOne({ user_id: req.params.profile_id, movie_id: String(req.params.movie_id) }).lean();
            const exists = !!(doc && !!doc.movie_bookmarked);
            res.send(exists);
        } catch (e) { res.send(false); }
    });

    // Lists
    server.get('/api/v1/user-movies/watched/:profile_id/:page?', async (req, res) => {
        var perPage = 18, page = Math.max(0, req.params.page || 1);
        try {
            const user = await User.findById(req.params.profile_id).lean();
            if (!user) return res.send(createError(404, { error: 'No user found' }));
            const entries = await UserMovie.find({ user_id: user._id, movie_watched_count: { $gt: 0 } }).lean();
            let movieList = entries.map(e => e.movie_id);
            const movies = await Movie.find({ 'tmd_id': { $in: movieList } }).collation({locale:'en',strength:2}).sort({ movie_title:1 }).lean();
            const totalResults = movies.length; const paged = paginateArray(movies, perPage, page);
            res.send({ page, per_page: perPage, user_id: user._id, username: user.local.username, total_results: totalResults, amount_of_results: paged.length, results: paged });
        } catch (e) { res.send(createError(400, e)); }
    });

    server.get('/api/v1/user-movies/favourited/:profile_id/:page?', async (req, res) => {
        var perPage = 18, page = Math.max(0, req.params.page || 1);
        try {
            const user = await User.findById(req.params.profile_id).lean();
            if (!user) return res.send(createError(404, { error: 'No user found' }));
            const entries = await UserMovie.find({ user_id: user._id, movie_favorite: { $ne: null } }).lean();
            let movieList = entries.map(e => e.movie_id);
            const movies = await Movie.find({ 'tmd_id': { $in: movieList } }).collation({locale:'en',strength:2}).sort({ movie_title:1 }).lean();
            const totalResults = movies.length; const paged = paginateArray(movies, perPage, page);
            res.send({ page, per_page: perPage, user_id: user._id, username: user.local.username, total_results: totalResults, amount_of_results: paged.length, results: paged });
        } catch (e) { res.send(createError(400, e)); }
    });

    server.get('/api/v1/user-movies/saved/:profile_id/:page?', async (req, res) => {
        var perPage = 18, page = Math.max(0, req.params.page || 1);
        try {
            const user = await User.findById(req.params.profile_id).lean();
            if (!user) return res.send(createError(404, { error: 'No user found' }));
            const entries = await UserMovie.find({ user_id: user._id, movie_bookmarked: { $ne: null } }).lean();
            let movieList = entries.map(e => e.movie_id);
            const movies = await Movie.find({ 'tmd_id': { $in: movieList } }).collation({locale:'en',strength:2}).sort({ movie_title:1 }).lean();
            const totalResults = movies.length; const paged = paginateArray(movies, perPage, page);
            res.send({ page, per_page: perPage, user_id: user._id, username: user.local.username, total_results: totalResults, amount_of_results: paged.length, results: paged });
        } catch (e) { res.send(createError(400, e)); }
    });

    // Latest watched (12)
    server.get('/api/v1/user-movies/latest/:profile_id', async (req, res) => {
        try {
            const user = await User.findById(req.params.profile_id).lean();
            if (!user) return res.sendStatus(400);
            const entries = await UserMovie.find({ user_id: user._id, movie_watched_count: { $gt: 0 } }).sort({ movie_watched: -1 }).limit(12).lean();
            const ids = entries.map(e => e.movie_id);
            const movies = await Movie.find({ 'tmd_id': { $in: ids } }).lean();
            // keep api order
            const sorted = []; ids.forEach(id => { movies.forEach(m => { if (String(m.tmd_id) === String(id)) sorted.push(m); }); });
            res.send({ user_id: user._id, username: user.local.username, amount_of_results: sorted.length, results: sorted });
        } catch (e) { res.sendStatus(400); }
    });

    // Totals
    server.get('/api/v1/user-movies/totals/:profile_id', async (req, res) => {
        try {
            const totals = await UserMovieTotals.findOne({ user_id: req.params.profile_id }).lean();
            if (!totals) return res.send({ user_id: req.params.profile_id, unique_movies_watched: 0, total_movies_watched: 0, total_runtime: 0 });
            res.send(totals);
        } catch (e) { res.send({ user_id: req.params.profile_id, unique_movies_watched: 0, total_movies_watched: 0, total_runtime: 0 }); }
    });
}
