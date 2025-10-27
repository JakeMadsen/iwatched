/*
*   Mongoose models
**************************/
const User = require('../../../../db/models/user');
const Show = require('../../../../db/models/show');
const UserShow = require('../../../../db/models/userShow');
const UserShowTotals = require('../../../../db/models/userShowTotals');

/*
*   Services
**************************/
const apiIsCorrectUser = require('../../../middleware/apiIsCorrectUser');
const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');
const paginateArray = require('../../../services/paginateArray');
const createError = require('http-errors');

async function ensureShowInDb(tmdbId){
    try {
        const found = await Show.findOne({ 'tmd_id': String(tmdbId) }).lean();
        if (found) return found;
        const info = await tmdService.tvInfo(tmdbId);
        let s = new Show(); s.initial(info); await s.save();
        return s.toObject();
    } catch (_) { return null; }
}

async function getOrCreateTotals(user_id){
    let totals = await UserShowTotals.findOne({ user_id });
    if (!totals){ totals = new UserShowTotals(); totals.initial(user_id); await totals.save(); }
    return totals;
}

function getShowRuntimeMinutes(info){
    try {
        if (!info) return 0;
        if (Array.isArray(info.episode_run_time) && info.episode_run_time[0]) return Number(info.episode_run_time[0]) || 0;
        return Number(info.runtime) || 0;
    } catch (_) { return 0; }
}

// Helpers to compute episodes + runtime
async function getSeasonStats(showId, seasonNumber){
    try {
        const s = await tmdService.tvSeasonInfo({ id: showId, season_number: seasonNumber }).catch(() => null);
        if (!s) return { episodes: 0, minutes: 0 };
        const eps = Array.isArray(s.episodes) ? s.episodes : [];
        let minutes = 0, episodes = 0;
        eps.forEach(ep => { episodes += 1; minutes += (typeof ep.runtime === 'number' ? (ep.runtime||0) : 0); });
        return { episodes, minutes };
    } catch (_) { return { episodes: 0, minutes: 0 }; }
}

function __mode(values){
    const counts = new Map();
    values.forEach(v => { const n = Number(v); if (!isFinite(n) || n <= 0) return; counts.set(n, (counts.get(n)||0)+1); });
    let best = 0, freq = 0; counts.forEach((c,v)=>{ if (c>freq || (c===freq && v>best)) { freq=c; best=v; } });
    return freq>0 ? best : 0;
}

async function getShowStats(showId){
    try {
        const show = await tmdService.tvInfo({ id: showId }).catch(() => ({}));
        const seasons = Array.isArray(show.seasons) ? show.seasons : [];
        const nums = seasons.map(s => s.season_number).filter(n => typeof n === 'number' && n !== 0);
        if (nums.length === 0) return { episodes: 0, minutes: 0, seasonNumbers: [], seasonEpisodes: {} };

        // TMDB often provides an array of typical runtimes for the series; use the most frequent as a last-resort fallback
        const seriesTypical = Array.isArray(show.episode_run_time) ? show.episode_run_time.map(Number).filter(n=>isFinite(n)&&n>0) : [];
        const seriesFallback = __mode(seriesTypical) || 0;

        const details = await Promise.all(nums.map(sn => tmdService.tvSeasonInfo({ id: showId, season_number: sn }).catch(() => null)));
        let minutes = 0, episodes = 0;
        const seasonEpisodes = {};

        details.forEach(sd => {
            if (!sd) return;
            const eps = Array.isArray(sd.episodes) ? sd.episodes : [];
            seasonEpisodes[Number(sd.season_number)] = eps.length;
            // Prefer per-season modal runtime when some episodes are missing a runtime
            const seasonKnown = eps.map(e => (typeof e.runtime==='number' && e.runtime>0) ? e.runtime : null).filter(v => v!=null);
            const seasonFallback = __mode(seasonKnown) || seriesFallback;
            eps.forEach(ep => {
                episodes += 1;
                const rt = (typeof ep.runtime === 'number' && ep.runtime > 0) ? ep.runtime : seasonFallback;
                minutes += (rt || 0);
            });
        });

        return { episodes, minutes, seasonNumbers: nums, seasonEpisodes };
    } catch (_) { return { episodes: 0, minutes: 0, seasonNumbers: [], seasonEpisodes: {} }; }
}

function isShowDocEmpty(doc){
    if (!doc) return true;
    const noCounts = !doc.show_watched && ((doc.show_watched_count||0) === 0);
    const noFlags = !doc.show_bookmarked && !doc.show_favorite;
    const noPersonal = !(doc.personal_note && String(doc.personal_note).trim()) && ((Number(doc.personal_rating)||0) === 0);
    const seasons = Array.isArray(doc.seasons) ? doc.seasons : [];
    const seasonsEmpty = seasons.length === 0 || seasons.every(s => ((s.watched_count||0) === 0) && !s.date_completed);
    return noCounts && noFlags && noPersonal && seasonsEmpty;
}

module.exports = (server) => {
    console.log('* UserShows Routes Loaded Into Server');

    // Add one watched episode
    server.post('/api/v1/user-shows/watch/add', apiIsCorrectUser, async (req, res) => {
        try {
            const user_id = req.body.user_id;
            const show_id = String(req.body.show_id || req.body.movie_id); // tolerate show_id/movie_id
            const season_number = req.body.season_number;
            if (!user_id || !show_id) return res.status(400).send({ status: 400, message: 'Missing user_id or show_id' });

            const info = await tmdService.tvInfo(show_id).catch(()=>({}));
            await ensureShowInDb(show_id);
            const runtime = Number(req.body.episode_runtime || getShowRuntimeMinutes(info) || 0) || 0;

            let doc = await UserShow.findOne({ user_id, show_id });
            const first = !doc || (doc.show_watched_count || 0) === 0;
            if (!doc){ doc = new UserShow(); doc.initial(user_id, show_id); }
            doc.markEpisodeWatched(season_number);
            await doc.save();

            const totals = await getOrCreateTotals(user_id);
            totals.incEpisode(first, runtime);
            await totals.save();

            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    

    // Remove one watched episode
    server.post('/api/v1/user-shows/watch/remove', apiIsCorrectUser, async (req, res) => {
        try {
            const user_id = req.body.user_id; const show_id = String(req.body.show_id || req.body.movie_id);
            const season_number = req.body.season_number;
            if (!user_id || !show_id) return res.status(400).send({ status: 400 });
            const info = await tmdService.tvInfo(show_id).catch(()=>({}));
            const runtime = Number(req.body.episode_runtime || getShowRuntimeMinutes(info) || 0) || 0;
            const doc = await UserShow.findOne({ user_id, show_id });
            if (!doc) return res.status(404).send({ status: 404, message: 'Entry not found' });
            const last = (doc.show_watched_count || 0) === 1;
            doc.unwatchEpisode(season_number); await doc.save();
            const totals = await getOrCreateTotals(user_id);
            totals.decEpisode(last, runtime); await totals.save();
            // Clean up if the document is now empty (accidental clicks)
            try {
                const fresh = await UserShow.findById(doc._id).lean();
                if (isShowDocEmpty(fresh)) { await UserShow.deleteOne({ _id: doc._id }); }
            } catch(_){}
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Complete/uncomplete entire show (update totals)
    server.post('/api/v1/user-shows/show/complete', apiIsCorrectUser, async (req, res) => {
        try {
            const user_id = req.body.user_id; const show_id = String(req.body.show_id || req.body.movie_id);
            if (!user_id || !show_id) return res.status(400).send({ status: 400 });
            const stats = await getShowStats(show_id);
            await ensureShowInDb(show_id);
            let doc = await UserShow.findOne({ user_id, show_id });
            const first = !doc || (doc.show_watched_count || 0) === 0;
            if (!doc){ doc = new UserShow(); doc.initial(user_id, show_id); }
            // Force-complete all non-special seasons and persist the seasons array explicitly
            const now = new Date();
            const existing = new Map(((doc.seasons||[])).map(s => [Number(s.season_number), s]));
            (stats.seasonNumbers || []).forEach(sn => {
                let s = existing.get(Number(sn));
                if (!s) { s = { season_number: Number(sn), watched_count: 0, date_completed: null }; }
                s.date_completed = now;
                // watched_count stores how many times the season was completed
                // Setting entire show as watched should count as the first completion, not episode count
                s.watched_count = Math.max(1, Number(s.watched_count)||0);
                existing.set(Number(sn), s);
            });
            doc.seasons = Array.from(existing.values());
            try { doc.markModified && doc.markModified('seasons'); } catch(_){}
            doc.show_watched = new Date(); if (!doc.show_watched_count || doc.show_watched_count === 0) doc.show_watched_count = 1;
            doc.date_updated = new Date(); await doc.save();

            const totals = await getOrCreateTotals(user_id);
            if (first) totals.unique_shows_watched = (totals.unique_shows_watched || 0) + 1;
            totals.total_episodes_watched = (totals.total_episodes_watched || 0) + (stats.episodes || 0);
            totals.total_runtime = (totals.total_runtime || 0) + (stats.minutes || 0);
            // Count all non-special seasons on complete
            const __seasonCount = Array.isArray(stats.seasonNumbers) ? stats.seasonNumbers.length : 0;
            totals.total_seasons_watched = (totals.total_seasons_watched || 0) + __seasonCount;
            await totals.save();
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Bulk status (watched/favourite/saved) for many shows
    server.post('/api/v1/user-shows/status/bulk', async (req, res) => {
        try {
            const user_id = String(req.body.profile_id||'');
            let ids = Array.isArray(req.body.ids) ? req.body.ids : [];
            ids = ids.map(String).filter(Boolean);
            if (!user_id || ids.length === 0) return res.send({ user_id, statuses: {} });
            const docs = await UserShow.find({ user_id, show_id: { $in: ids.map(String) } }).select('show_id show_watched_count show_watched show_favorite show_bookmarked seasons.date_completed').lean();
            const map = {}; ids.forEach(id => { map[String(id)] = { w:false, f:false, s:false }; });
            (docs||[]).forEach(d => {
                const id = String(d.show_id);
                const anySeasonCompleted = !!(d && Array.isArray(d.seasons) && d.seasons.some(s => !!s.date_completed));
                map[id] = {
                    w: !!(((d.show_watched_count||0) > 0) || !!d.show_watched || anySeasonCompleted),
                    f: !!d.show_favorite,
                    s: !!d.show_bookmarked
                };
            });
            res.send({ user_id, statuses: map });
        } catch (e) { res.send({ statuses: {} }); }
    });
    server.post('/api/v1/user-shows/show/uncomplete', apiIsCorrectUser, async (req, res) => {
        try {
            const user_id = req.body.user_id; const show_id = String(req.body.show_id || req.body.movie_id);
            if (!user_id || !show_id) return res.status(400).send({ status: 400 });
            const doc = await UserShow.findOne({ user_id, show_id }); if (!doc) return res.status(404).send({ status: 404 });
            const wasWatched = ((doc.show_watched_count || 0) > 0) || !!doc.show_watched;
            const stats = await getShowStats(show_id);
            doc.show_watched = null; doc.show_watched_count = 0; (doc.seasons || []).forEach(s => { s.date_completed = null; });
            doc.date_updated = new Date(); await doc.save();

            const totals = await getOrCreateTotals(user_id);
            if (wasWatched && (totals.unique_shows_watched || 0) > 0) totals.unique_shows_watched -= 1;
            totals.total_episodes_watched = Math.max(0, (totals.total_episodes_watched || 0) - (stats.episodes || 0));
            totals.total_runtime = Math.max(0, (totals.total_runtime || 0) - (stats.minutes || 0));
            const __seasonCount2 = Array.isArray(stats.seasonNumbers) ? stats.seasonNumbers.length : 0;
            totals.total_seasons_watched = Math.max(0, (totals.total_seasons_watched || 0) - __seasonCount2);
            await totals.save();
            // Clean up if now empty
            try {
                const fresh = await UserShow.findById(doc._id).lean();
                if (isShowDocEmpty(fresh)) { await UserShow.deleteOne({ _id: doc._id }); }
            } catch(_){}
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Bookmark add/remove
    server.post('/api/v1/user-shows/bookmark/add', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id } = req.body; const show_id = String(req.body.show_id || req.body.movie_id);
            if (!user_id || !show_id) return res.status(400).send({ status: 400 });
            await ensureShowInDb(show_id);
            let doc = await UserShow.findOne({ user_id, show_id });
            if (!doc){ doc = new UserShow(); doc.initial(user_id, show_id); }
            doc.setBookmarked(true); await doc.save();
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });
    server.post('/api/v1/user-shows/bookmark/remove', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id } = req.body; const show_id = String(req.body.show_id || req.body.movie_id);
            if (!user_id || !show_id) return res.status(400).send({ status: 400 });
            const doc = await UserShow.findOne({ user_id, show_id });
            if (!doc) return res.status(404).send({ status: 404 });
            doc.setBookmarked(false); await doc.save();
            try { const fresh = await UserShow.findById(doc._id).lean(); if (isShowDocEmpty(fresh)) { await UserShow.deleteOne({ _id: doc._id }); } } catch(_){}
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Favourite add/remove
    server.post('/api/v1/user-shows/favourited/add', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id } = req.body; const show_id = String(req.body.show_id || req.body.movie_id);
            if (!user_id || !show_id) return res.status(400).send({ status: 400 });
            await ensureShowInDb(show_id);
            let doc = await UserShow.findOne({ user_id, show_id });
            if (!doc){ doc = new UserShow(); doc.initial(user_id, show_id); }
            doc.setFavourited(true); await doc.save();
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });
    server.post('/api/v1/user-shows/favourited/remove', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id } = req.body; const show_id = String(req.body.show_id || req.body.movie_id);
            if (!user_id || !show_id) return res.status(400).send({ status: 400 });
            const doc = await UserShow.findOne({ user_id, show_id });
            if (!doc) return res.status(404).send({ status: 404 });
            doc.setFavourited(false); await doc.save();
            try { const fresh = await UserShow.findById(doc._id).lean(); if (isShowDocEmpty(fresh)) { await UserShow.deleteOne({ _id: doc._id }); } } catch(_){}
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Season complete/uncomplete (update totals)
    server.post('/api/v1/user-shows/season/complete', apiIsCorrectUser, async (req, res) => {
        try {
            const user_id = req.body.user_id; const show_id = String(req.body.show_id || req.body.movie_id);
            const season_number = Number(req.body.season_number);
            if (!user_id || !show_id || isNaN(season_number)) return res.status(400).send({ status: 400 });
            await ensureShowInDb(show_id);
            let doc = await UserShow.findOne({ user_id, show_id }); if (!doc){ doc = new UserShow(); doc.initial(user_id, show_id); }
            const existing = (doc.seasons || []).find(s => Number(s.season_number) === season_number);
            const wasCompleted = !!(existing && existing.date_completed);
            const preWatched = ((doc.show_watched_count||0) > 0) || !!doc.show_watched || ((doc.seasons||[]).some(s => !!s.date_completed));
            if (!wasCompleted) doc.setSeasonCompleted(season_number, true);
            let becameWatched = false;
            try {
                const info = await tmdService.tvInfo(show_id).catch(()=>({ seasons: [] }));
                const seasonNums = (info.seasons||[]).map(s=>s.season_number).filter(n=>typeof n==='number' && n!==0);
                const completed = (doc.seasons||[]).filter(s=>s.date_completed != null).map(s=>s.season_number);
                const allDone = seasonNums.length>0 && seasonNums.every(n=>completed.includes(n));
                if (allDone){ if (!doc.show_watched) becameWatched = true; doc.show_watched = new Date(); if (!doc.show_watched_count) doc.show_watched_count = 1; }
            } catch(_){}
            doc.date_updated = new Date(); await doc.save();
            if (!wasCompleted){
                const stats = await getSeasonStats(show_id, season_number);
                // Persist first completion count (times watched, not episodes)
                try {
                    const idx = (doc.seasons||[]).findIndex(s => Number(s.season_number)===season_number);
                    if (idx >= 0){ doc.seasons[idx].watched_count = Math.max(1, Number(doc.seasons[idx].watched_count)||0); await doc.save(); }
                } catch(_){}
                const totals = await getOrCreateTotals(user_id);
                // Increment unique shows when this was the very first watched action for this show
                if (!preWatched) totals.unique_shows_watched = (totals.unique_shows_watched || 0) + 1;
                totals.total_episodes_watched = (totals.total_episodes_watched || 0) + (stats.episodes || 0);
                totals.total_runtime = (totals.total_runtime || 0) + (stats.minutes || 0);
                totals.total_seasons_watched = (totals.total_seasons_watched || 0) + 1;
                await totals.save();
            }
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });
    server.post('/api/v1/user-shows/season/uncomplete', apiIsCorrectUser, async (req, res) => {
        try {
            const user_id = req.body.user_id; const show_id = String(req.body.show_id || req.body.movie_id);
            const season_number = Number(req.body.season_number);
            if (!user_id || !show_id || isNaN(season_number)) return res.status(400).send({ status: 400 });
            const doc = await UserShow.findOne({ user_id, show_id }); if (!doc) return res.status(404).send({ status: 404 });
            const existing = (doc.seasons || []).find(s => Number(s.season_number) === season_number);
            const wasCompleted = !!(existing && existing.date_completed);
            doc.setSeasonCompleted(season_number, false);
            const wasWatched = !!doc.show_watched || (doc.show_watched_count||0) > 0 || ((doc.seasons||[]).some(s => !!s.date_completed));
            doc.show_watched = null; doc.show_watched_count = 0; // season completion governs watched state here
            doc.date_updated = new Date(); await doc.save();
            if (wasCompleted){
                const stats = await getSeasonStats(show_id, season_number);
                const totals = await getOrCreateTotals(user_id);
                // Decrement unique shows only if this action makes the show entirely un-watched
                const stillWatched = ((doc.show_watched_count||0) > 0) || !!doc.show_watched || ((doc.seasons||[]).some(s => !!s.date_completed));
                if (!stillWatched && (totals.unique_shows_watched || 0) > 0) totals.unique_shows_watched -= 1;
                totals.total_episodes_watched = Math.max(0, (totals.total_episodes_watched || 0) - (stats.episodes || 0));
                totals.total_runtime = Math.max(0, (totals.total_runtime || 0) - (stats.minutes || 0));
                if ((totals.total_seasons_watched || 0) > 0) totals.total_seasons_watched -= 1;
                await totals.save();
            }
            // Clean up if now empty
            try {
                const fresh = await UserShow.findById(doc._id).lean();
                if (isShowDocEmpty(fresh)) { await UserShow.deleteOne({ _id: doc._id }); }
            } catch(_){}
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Note & Rating
    server.post('/api/v1/user-shows/note/set', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id, personal_note } = req.body; const show_id = String(req.body.show_id || req.body.movie_id);
            if (!user_id || !show_id) return res.status(400).send({ status: 400 });
            let doc = await UserShow.findOne({ user_id, show_id }); if (!doc){ doc = new UserShow(); doc.initial(user_id, show_id); }
            doc.setNote(personal_note || ""); await doc.save();
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });
    server.post('/api/v1/user-shows/rating/set', apiIsCorrectUser, async (req, res) => {
        try {
            const { user_id, personal_rating } = req.body; const show_id = String(req.body.show_id || req.body.movie_id);
            if (!user_id || !show_id) return res.status(400).send({ status: 400 });
            let doc = await UserShow.findOne({ user_id, show_id }); if (!doc){ doc = new UserShow(); doc.initial(user_id, show_id); }
            doc.setRating(personal_rating); await doc.save();
            if (!res.headersSent) return res.status(200).send({ status: 'ok' });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Checks
    server.get('/api/v1/user-shows/check/watched/:profile_id/:show_id', async (req, res) => {
        try {
            const doc = await UserShow.findOne({ user_id: req.params.profile_id, show_id: String(req.params.show_id) }).lean();
            const anySeasonCompleted = !!(doc && Array.isArray(doc.seasons) && doc.seasons.some(s => !!s.date_completed));
            res.send(!!(doc && (((doc.show_watched_count||0) > 0) || !!doc.show_watched || anySeasonCompleted)));
        } catch (e) { res.send(false); }
    });
    server.get('/api/v1/user-shows/check/season/:profile_id/:show_id/:season_number', async (req, res) => {
        try {
            const sn = Number(req.params.season_number);
            const doc = await UserShow.findOne({ user_id: req.params.profile_id, show_id: String(req.params.show_id) }).lean();
            const exists = !!(doc && Array.isArray(doc.seasons) && doc.seasons.find(s => Number(s.season_number)===sn && !!s.date_completed));
            res.send(exists);
        } catch (e) { res.send(false); }
    });
    server.get('/api/v1/user-shows/check/favourited/:profile_id/:show_id', async (req, res) => {
        try { const doc = await UserShow.findOne({ user_id: req.params.profile_id, show_id: String(req.params.show_id) }).lean(); res.send(!!(doc && !!doc.show_favorite)); } catch (e) { res.send(false); }
    });
    server.get('/api/v1/user-shows/check/saved/:profile_id/:show_id', async (req, res) => {
        try { const doc = await UserShow.findOne({ user_id: req.params.profile_id, show_id: String(req.params.show_id) }).lean(); res.send(!!(doc && !!doc.show_bookmarked)); } catch (e) { res.send(false); }
    });

    // Lists
    server.get('/api/v1/user-shows/watched/:profile_id/:page?', async (req, res) => {
        var perPage = 18, page = Math.max(0, req.params.page || 1);
        const sort = String(req.query.sort || '').toLowerCase();
        try {
            const user = await User.findById(req.params.profile_id).lean();
            if (!user) return res.send(createError(404, { error: 'No user found' }));
            // Consider watched if: show_watched_count > 0 OR show_watched set OR any season completed
            const entries = await UserShow.find({
                user_id: user._id,
                $or: [
                    { show_watched_count: { $gt: 0 } },
                    { show_watched: { $ne: null } },
                    { seasons: { $elemMatch: { date_completed: { $ne: null } } } }
                ]
            }).lean();
            const list = Array.from(new Set(entries.map(e => String(e.show_id))));
            let items = await Show.find({ 'tmd_id': { $in: list } }).collation({locale:'en',strength:2}).sort({ show_title:1 }).lean();
            // Backfill missing Show docs if any
            const have = new Set(items.map(s => String(s.tmd_id)));
            const missing = list.filter(id => !have.has(String(id)));
            if (missing.length){
                const created = await Promise.all(missing.map(id => ensureShowInDb(id)));
                items = items.concat(created.filter(Boolean));
            }
            // De-duplicate by tmd_id in case of legacy duplicates
            const uniqMap = new Map();
            items.forEach(it => { if (it && it.tmd_id && !uniqMap.has(String(it.tmd_id))) uniqMap.set(String(it.tmd_id), it); });
            items = Array.from(uniqMap.values());

            if (sort) {
                const details = await Promise.all(items.map(s => tmdService.tvInfo(s.tmd_id).catch(()=>null)));
                const map = new Map();
                items.forEach((s, idx) => {
                    const d = details[idx] || {};
                    const seasons = Array.isArray(d.seasons) ? d.seasons.filter(x => Number(x.season_number) !== 0).length : (d.number_of_seasons || 0);
                    map.set(String(s.tmd_id), {
                        seasons: seasons || 0,
                        first_air_date: d.first_air_date || null,
                        first_air_year: d.first_air_date ? String(d.first_air_date).slice(0,4) : null
                    });
                });
                items = items.map(s => Object.assign({}, s, map.get(String(s.tmd_id)) || {}));
                const cmp = (a,b,k,dir) => { const av=a[k]||0, bv=b[k]||0; return dir==='desc' ? ((bv>av)-(bv<av)) : ((av>bv)-(av<bv)); };
                if (sort === 'seasons_desc') items.sort((a,b)=>cmp(a,b,'seasons','desc'));
                else if (sort === 'seasons_asc') items.sort((a,b)=>cmp(a,b,'seasons','asc'));
                else if (sort === 'first_air_desc') items.sort((a,b)=>cmp(a,b,'first_air_year','desc'));
                else if (sort === 'first_air_asc') items.sort((a,b)=>cmp(a,b,'first_air_year','asc'));
            }

            const total = items.length; const pageItems = paginateArray(items, perPage, page);
            // Return quickly; client will fetch posters asynchronously with caching
            return res.send({ page, per_page: perPage, user_id: user._id, username: user.local.username, total_results: total, amount_of_results: pageItems.length, results: pageItems });
        } catch (e) { res.send(createError(400, e)); }
    });

    server.get('/api/v1/user-shows/favourited/:profile_id/:page?', async (req, res) => {
        var perPage = 18, page = Math.max(0, req.params.page || 1);
        try {
            const user = await User.findById(req.params.profile_id).lean();
            if (!user) return res.send(createError(404, { error: 'No user found' }));
            const entries = await UserShow.find({ user_id: user._id, show_favorite: { $ne: null } }).lean();
            const list = entries.map(e => e.show_id);
            const items = await Show.find({ 'tmd_id': { $in: list } }).collation({locale:'en',strength:2}).sort({ show_title:1 }).lean();
            const total = items.length; const pageItems = paginateArray(items, perPage, page);
            try {
                const ids = pageItems.map(s => s.tmd_id);
                const details = await Promise.all(ids.map(id => tmdService.tvInfo(id).catch(()=>null)));
                const enriched = pageItems.map((s, idx) => { const d = details[idx] || {}; const poster = d.poster_path || d.backdrop_path || null; return Object.assign({}, s, { poster_path: poster }); });
                return res.send({ page, per_page: perPage, user_id: user._id, username: user.local.username, total_results: total, amount_of_results: enriched.length, results: enriched });
            } catch(_) { return res.send({ page, per_page: perPage, user_id: user._id, username: user.local.username, total_results: total, amount_of_results: pageItems.length, results: pageItems }); }
        } catch (e) { res.send(createError(400, e)); }
    });

    server.get('/api/v1/user-shows/saved/:profile_id/:page?', async (req, res) => {
        var perPage = 18, page = Math.max(0, req.params.page || 1);
        try {
            const user = await User.findById(req.params.profile_id).lean();
            if (!user) return res.send(createError(404, { error: 'No user found' }));
            const entries = await UserShow.find({ user_id: user._id, show_bookmarked: { $ne: null } }).lean();
            const list = entries.map(e => e.show_id);
            const items = await Show.find({ 'tmd_id': { $in: list } }).collation({locale:'en',strength:2}).sort({ show_title:1 }).lean();
            const total = items.length; const pageItems = paginateArray(items, perPage, page);
            try {
                const ids = pageItems.map(s => s.tmd_id);
                const details = await Promise.all(ids.map(id => tmdService.tvInfo(id).catch(()=>null)));
                const enriched = pageItems.map((s, idx) => { const d = details[idx] || {}; const poster = d.poster_path || d.backdrop_path || null; return Object.assign({}, s, { poster_path: poster }); });
                return res.send({ page, per_page: perPage, user_id: user._id, username: user.local.username, total_results: total, amount_of_results: enriched.length, results: enriched });
            } catch(_) { return res.send({ page, per_page: perPage, user_id: user._id, username: user.local.username, total_results: total, amount_of_results: pageItems.length, results: pageItems }); }
        } catch (e) { res.send(createError(400, e)); }
    });

    // Latest watched (up to 12)
    server.get('/api/v1/user-shows/latest/:profile_id', async (req, res) => {
        try {
            const user = await User.findById(req.params.profile_id).lean();
            if (!user) return res.sendStatus(400);
            const entries = await UserShow.find({ user_id: user._id, show_watched_count: { $gt: 0 } }).sort({ show_watched: -1 }).limit(12).lean();
            const ids = entries.map(e => e.show_id);
            const shows = await Show.find({ 'tmd_id': { $in: ids } }).lean();
            const sorted = []; ids.forEach(id => { shows.forEach(s => { if (String(s.tmd_id) === String(id)) sorted.push(s); }); });
            res.send({ user_id: user._id, username: user.local.username, amount_of_results: sorted.length, results: sorted });
        } catch (e) { res.sendStatus(400); }
    });

    // Totals
    server.get('/api/v1/user-shows/totals/:profile_id', async (req, res) => {
        try {
            const totals = await UserShowTotals.findOne({ user_id: req.params.profile_id }).lean();
            if (!totals) return res.send({ user_id: req.params.profile_id, unique_shows_watched: 0, total_episodes_watched: 0, total_runtime: 0 });
            res.send(totals);
        } catch (e) { res.send({ user_id: req.params.profile_id, unique_shows_watched: 0, total_episodes_watched: 0, total_runtime: 0 }); }
    });
}
