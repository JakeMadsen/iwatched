const isLoggedIn = require('../../middleware/isLoggedIn')
const templatePath = 'private assets/template.ejs';
const userService =  require('../../services/users');
const User = require('../../../db/models/user');
const hat = require('hat');
const BannedAccount = require('../../../db/models/bannedAccount');
const UserSession = require('../../../db/models/userSession');
const ModeratorPersona = require('../../../db/models/moderatorPersona');
const ModerationLog = require('../../../db/models/moderationLog');
const UserMovie = require('../../../db/models/userMovie');
const UserMovieTotals = require('../../../db/models/userMovieTotals');
const UserShow = require('../../../db/models/userShow');
const UserShowTotals = require('../../../db/models/userShowTotals');
const Movie = require('../../../db/models/movie');
const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Background jobs + runtime caches (in-memory + file)
// Movies
const jobs = new Map(); // movie jobId -> state
let currentJobId = null;
let jobSeq = 0;
const runtimeCacheMem = new Map(); // movieId -> { runtime, title }
const cacheDir = (function(){
    if (process.env.IWATCHED_CACHE_DIR) return process.env.IWATCHED_CACHE_DIR;
    const isDev = (process.env.NODE_ENV !== 'production') || String(process.env.SERVER_DEV||'').toLowerCase() === 'true';
    return isDev ? path.join(os.tmpdir(), 'iwatched', 'cache') : path.join(process.cwd(), 'bin', 'cache');
})();
const cacheFile = path.join(cacheDir, 'movie_runtime_cache.json');
// Shows
const jobsShows = new Map(); // show jobId -> state
let currentShowsJobId = null;
let jobSeqShows = 0;
const showSeasonCacheMem = new Map(); // `${showId}_${season}` -> { minutes, episodes }
const showAvgCacheMem = new Map();     // showId -> { avg }
const showSeasonCacheFile = path.join(cacheDir, 'show_season_runtime_cache.json');
const showAvgCacheFile = path.join(cacheDir, 'show_avg_runtime_cache.json');
function ensureCacheLoaded(){
    try {
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        if (fs.existsSync(cacheFile)){
            const raw = JSON.parse(fs.readFileSync(cacheFile,'utf8'));
            Object.keys(raw||{}).forEach(id => {
                const v = raw[id];
                if (v && typeof v.runtime === 'number') runtimeCacheMem.set(String(id), { runtime: v.runtime, title: v.title || '' });
            });
        }
        if (fs.existsSync(showSeasonCacheFile)){
            const raw2 = JSON.parse(fs.readFileSync(showSeasonCacheFile,'utf8'));
            Object.keys(raw2||{}).forEach(key => { const v = raw2[key]; if (v && typeof v.minutes === 'number') showSeasonCacheMem.set(String(key), { minutes: v.minutes||0, episodes: v.episodes||0 }); });
        }
        if (fs.existsSync(showAvgCacheFile)){
            const raw3 = JSON.parse(fs.readFileSync(showAvgCacheFile,'utf8'));
            Object.keys(raw3||{}).forEach(id => { const v = raw3[id]; if (v && typeof v.avg === 'number') showAvgCacheMem.set(String(id), { avg: v.avg||0 }); });
        }
    } catch(_){}
}
function persistCache(){
    try {
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        const obj = {};
        for (const [id, val] of runtimeCacheMem.entries()){
            obj[id] = { runtime: Number(val.runtime)||0, title: val.title||'' };
        }
        fs.writeFileSync(cacheFile, JSON.stringify(obj, null, 2), 'utf8');
        const obj2 = {};
        for (const [key, val] of showSeasonCacheMem.entries()){
            obj2[key] = { minutes: Number(val.minutes)||0, episodes: Number(val.episodes)||0 };
        }
        fs.writeFileSync(showSeasonCacheFile, JSON.stringify(obj2, null, 2), 'utf8');
        const obj3 = {};
        for (const [id, val] of showAvgCacheMem.entries()){
            obj3[id] = { avg: Number(val.avg)||0 };
        }
        fs.writeFileSync(showAvgCacheFile, JSON.stringify(obj3, null, 2), 'utf8');
    } catch(_){}
}
function newJobId(){ jobSeq += 1; return String(jobSeq); }
function newShowsJobId(){ jobSeqShows += 1; return `S${jobSeqShows}`; }
function capLogs(logs){ const MAX = 1000; if (logs.length > MAX) logs.splice(0, logs.length - MAX); }
async function runRecalcJob(job){
    ensureCacheLoaded();
    try {
        if (job && job.options && job.options.clearCache) {
            try { runtimeCacheMem.clear(); } catch(_){}
            try { if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile); } catch(_){}
        }
        const users = await UserMovie.distinct('user_id', { movie_watched_count: { $gt: 0 } });
        job.totalUsers = users.length;
        job.status = 'running';
        for (let i=0; i<users.length; i++){
            const uid = users[i];
            job.userIndex = i;
            try { job.currentUser = await User.findById(uid).lean(); } catch(_) { job.currentUser = { _id: uid }; }
            job.nextUser = (i+1)<users.length ? String(users[i+1]) : null;
            const uname = (job.currentUser && job.currentUser.local && job.currentUser.local.username) || '';
            job.logs.push(`Starting user ${String(uid)}${uname?` (${uname})`:''}`); capLogs(job.logs);
            const entries = await UserMovie.find({ user_id: uid, movie_watched_count: { $gt: 0 } }).select('_id movie_id movie_watched_count movie_runtime').lean();
            job.currentUserTotalMovies = entries.length;
            job.currentUserProcessed = 0;
            let total = 0;
            for (const doc of entries){
                const movieId = String(doc.movie_id);
                let meta = (job && job.options && job.options.forceRefresh) ? null : (runtimeCacheMem.get(movieId) || null);
                if (!meta){
                    let runtime = 0, title = '';
                    // Prefer stored runtime on the user-movie doc first
                    if (Number(doc.movie_runtime) > 0) {
                        runtime = Number(doc.movie_runtime);
                    } else {
                        // Try cached Movie collection next
                        try {
                            const m = await Movie.findOne({ tmd_id: movieId }).lean();
                            if (m && m.movie_runtime) runtime = Number(m.movie_runtime) || 0;
                        } catch(_) {}
                        // Fallback to TMDB live
                        if (!runtime) {
                            try { const info = await tmdService.movieInfo(movieId); runtime = Number(info && info.runtime) || 0; title = (info && info.title) ? String(info.title) : ''; } catch(_){}
                        }
                    }
                    meta = { runtime, title }; runtimeCacheMem.set(movieId, meta);
                }
                // Backfill missing runtime on the user_movie document when we have a reliable runtime
                if ((!doc.movie_runtime || Number(doc.movie_runtime) === 0) && meta.runtime > 0) {
                    try { await UserMovie.updateOne({ _id: doc._id }, { $set: { movie_runtime: Number(meta.runtime) } }); } catch(_){}
                }
                const { runtime, title } = meta;
                const count = Number(doc.movie_watched_count || 0);
                const link = `/movies/${movieId}`;
                if (!runtime){
                    job.logs.push(`Runtime missing or zero for movie ${movieId}${title?` (${title})`:''} - skipped. ${link}`);
                    capLogs(job.logs);
                    job.currentUserProcessed++;
                    continue;
                }
                const add = runtime * count; total += add;
                job.currentUserProcessed++;
            }
            let totals = await UserMovieTotals.findOne({ user_id: uid });
            if (!totals){ totals = new UserMovieTotals(); totals.initial(uid); }
            const prev = Number(totals.total_runtime || 0);
            totals.total_runtime = total; await totals.save();
            job.logs.push(`Finished user ${String(uid)}${uname?` (${uname})`:''}. Updated total runtime: ${prev} -> ${total} minutes.${job.nextUser?` Moving onto ${job.nextUser}.`:''}`);
            capLogs(job.logs);
            if (job.cancelAfterCurrent === true) break;
        }
        persistCache();
        job.status = 'done';
    } catch (e) {
        job.status = 'error'; job.logs.push(`Error: ${e && e.message ? e.message : e}`); capLogs(job.logs);
    } finally { currentJobId = null; }
}

async function getShowAvgRuntime(showId, force){
    const k = String(showId);
    if (!force){ const c = showAvgCacheMem.get(k); if (c && c.avg) return c.avg; }
    try { const info = await tmdService.tvInfo({ id: k }); const avg = Array.isArray(info && info.episode_run_time) && info.episode_run_time[0] ? Number(info.episode_run_time[0]) : 0; showAvgCacheMem.set(k, { avg }); return avg; } catch(_) { showAvgCacheMem.set(k, { avg: 0 }); return 0; }
}

async function getSeasonMinutes(showId, seasonNumber, force){
    const key = `${String(showId)}_${Number(seasonNumber)}`;
    if (!force){ const c = showSeasonCacheMem.get(key); if (c) return c; }
    let minutes = 0, episodes = 0;
    try {
        const avg = await getShowAvgRuntime(showId, force);
        const s = await tmdService.tvSeasonInfo({ id: String(showId), season_number: Number(seasonNumber) });
        const eps = Array.isArray(s && s.episodes) ? s.episodes : [];
        episodes = eps.length;
        for (const ep of eps){ const rt = (typeof ep.runtime==='number' && ep.runtime>0) ? ep.runtime : (avg||0); minutes += Number(rt||0); }
    } catch(_){ minutes = 0; episodes = 0; }
    const val = { minutes, episodes }; showSeasonCacheMem.set(key, val); return val;
}

async function runRecalcShowsJob(job){
    ensureCacheLoaded();
    try {
        if (job && job.options && job.options.clearCache) {
            try { showSeasonCacheMem.clear(); } catch(_){}
            try { showAvgCacheMem.clear(); } catch(_){}
            try { if (fs.existsSync(showSeasonCacheFile)) fs.unlinkSync(showSeasonCacheFile); } catch(_){}
            try { if (fs.existsSync(showAvgCacheFile)) fs.unlinkSync(showAvgCacheFile); } catch(_){}
        }
        const users = await UserShow.distinct('user_id', { seasons: { $elemMatch: { date_completed: { $ne: null } } } });
        job.totalUsers = users.length; job.status = 'running';
        for (let i=0; i<users.length; i++){
            const uid = users[i]; job.userIndex = i;
            try { job.currentUser = await User.findById(uid).lean(); } catch(_) { job.currentUser = { _id: uid }; }
            job.nextUser = (i+1)<users.length ? String(users[i+1]) : null;
            const uname = (job.currentUser && job.currentUser.local && job.currentUser.local.username) || '';
            job.logs.push(`Starting user ${String(uid)}${uname?` (${uname})`:''}`); capLogs(job.logs);
            const entries = await UserShow.find({ user_id: uid, seasons: { $elemMatch: { date_completed: { $ne: null } } } }).select('show_id seasons').lean();
            // total items processed counts completed seasons
            const completedPairs = [];
            for (const doc of entries){
                const completed = (Array.isArray(doc.seasons)? doc.seasons: [])
                    .filter(s => !!s.date_completed)
                    .map(s => Number(s.season_number))
                    .filter(sn => isFinite(sn) && sn !== 0); // skip specials (S0)
                for (const sn of completed){ completedPairs.push({ show_id: String(doc.show_id), season: sn }); }
            }
            job.currentUserTotalMovies = completedPairs.length; // reuse fields: total seasons
            job.currentUserProcessed = 0;
            let totalMinutes = 0, totalEpisodes = 0, totalSeasons = 0;
            for (const pair of completedPairs){
                const { show_id, season } = pair;
                const m = await getSeasonMinutes(show_id, season, !!(job && job.options && job.options.forceRefresh));
                if (!m || !m.minutes){
                    const link = `/shows/${show_id}`;
                    job.logs.push(`Runtime missing or zero for show ${show_id} S${season} - skipped. ${link}`); capLogs(job.logs);
                } else {
                    totalMinutes += m.minutes; totalEpisodes += (m.episodes||0); totalSeasons += 1;
                }
                job.currentUserProcessed++;
            }
            let totals = await UserShowTotals.findOne({ user_id: uid });
            if (!totals){ totals = new UserShowTotals(); totals.initial(uid); }
            const prev = { m: Number(totals.total_runtime||0), s: Number(totals.total_seasons_watched||0), e: Number(totals.total_episodes_watched||0) };
            totals.total_runtime = totalMinutes;
            totals.total_seasons_watched = totalSeasons;
            totals.total_episodes_watched = totalEpisodes;
            await totals.save();
            job.logs.push(`Finished user ${String(uid)}${uname?` (${uname})`:''}. Updated totals: minutes ${prev.m} -> ${totalMinutes}, seasons ${prev.s} -> ${totalSeasons}, episodes ${prev.e} -> ${totalEpisodes}.${job.nextUser?` Moving onto ${job.nextUser}.`:''}`); capLogs(job.logs);
            if (job.cancelAfterCurrent === true) break;
        }
        persistCache(); job.status = 'done';
    } catch (e) { job.status = 'error'; job.logs.push(`Error: ${e && e.message ? e.message : e}`); capLogs(job.logs); }
    finally { currentShowsJobId = null; }
}


module.exports = (server) => {
    console.log('* User Page Routes Loaded Into Server');


    server.get('/admin/users', isLoggedIn, async (req, res) => {

        res.render(templatePath, {
            page_title: "iWatched - Admin",
            page_file: "users",
            page_data: {
                users: await userService.getAll()
            },
            user: req.user
        })
    });

    // Users Tools landing (page shell; dynamic status via polling)
    server.get('/admin/users/tools', isLoggedIn, async (req, res) => {
        res.render(templatePath, {
            page_title: "iWatched - Admin",
            page_file: "users_tools",
            page_data: { },
            user: req.user
        });
    });

    // Job control endpoints for movie runtime recalculation
    server.get('/admin/users/tools/recalculate-movies/active', isLoggedIn, async (req, res) => {
        if (currentJobId && jobs.has(currentJobId)) return res.status(200).send({ jobId: currentJobId });
        return res.status(200).send({ jobId: null });
    });
    server.post('/admin/users/tools/recalculate-movies/start', isLoggedIn, async (req, res) => {
        if (currentJobId && jobs.has(currentJobId)) return res.status(409).send({ jobId: currentJobId, message: 'Job already running' });
        const id = newJobId();
        const opts = { forceRefresh: !!(req.body && req.body.forceRefresh), clearCache: !!(req.body && req.body.clearCache) };
        const job = { id, status: 'queued', totalUsers: 0, userIndex: 0, currentUser: null, currentUserTotalMovies: 0, currentUserProcessed: 0, nextUser: null, cancelAfterCurrent: false, logs: [], options: opts };
        jobs.set(id, job); currentJobId = id;
        setImmediate(() => runRecalcJob(job));
        return res.status(200).send({ jobId: id });
    });
    server.get('/admin/users/tools/recalculate-movies/status/:jobId', isLoggedIn, async (req, res) => {
        const job = jobs.get(String(req.params.jobId));
        if (!job) return res.status(404).send({ error: 'Not found' });
        const curr = job.currentUser || {};
        const percent = (job.currentUserTotalMovies>0) ? Math.floor((job.currentUserProcessed / job.currentUserTotalMovies) * 100) : 0;
        return res.status(200).send({
            status: job.status,
            total_users: job.totalUsers,
            user_index: job.userIndex,
            current_user: { id: curr._id || null, username: curr.local && curr.local.username || null },
            current_progress_percent: percent,
            next_user: job.nextUser,
            cancel_after_current: !!job.cancelAfterCurrent,
            logs: job.logs.slice(-300)
        });
    });
    server.post('/admin/users/tools/recalculate-movies/cancel', isLoggedIn, async (req, res) => {
        const id = String((req.body && req.body.jobId) || currentJobId || '');
        const job = jobs.get(id);
        if (!job) return res.status(404).send({ error: 'No active job' });
        job.cancelAfterCurrent = true;
        return res.status(200).send({ ok: true });
    });

    // Job control endpoints for show runtime recalculation
    server.get('/admin/users/tools/recalculate-shows/active', isLoggedIn, async (req, res) => {
        if (currentShowsJobId && jobsShows.has(currentShowsJobId)) return res.status(200).send({ jobId: currentShowsJobId });
        return res.status(200).send({ jobId: null });
    });
    server.post('/admin/users/tools/recalculate-shows/start', isLoggedIn, async (req, res) => {
        if (currentShowsJobId && jobsShows.has(currentShowsJobId)) return res.status(409).send({ jobId: currentShowsJobId, message: 'Job already running' });
        const id = newShowsJobId();
        const opts = { forceRefresh: !!(req.body && req.body.forceRefresh), clearCache: !!(req.body && req.body.clearCache) };
        const job = { id, status: 'queued', totalUsers: 0, userIndex: 0, currentUser: null, currentUserTotalMovies: 0, currentUserProcessed: 0, nextUser: null, cancelAfterCurrent: false, logs: [], options: opts };
        jobsShows.set(id, job); currentShowsJobId = id;
        setImmediate(() => runRecalcShowsJob(job));
        return res.status(200).send({ jobId: id });
    });
    server.get('/admin/users/tools/recalculate-shows/status/:jobId', isLoggedIn, async (req, res) => {
        const job = jobsShows.get(String(req.params.jobId));
        if (!job) return res.status(404).send({ error: 'Not found' });
        const curr = job.currentUser || {};
        const percent = (job.currentUserTotalMovies>0) ? Math.floor((job.currentUserProcessed / job.currentUserTotalMovies) * 100) : 0;
        return res.status(200).send({
            status: job.status,
            total_users: job.totalUsers,
            user_index: job.userIndex,
            current_user: { id: curr._id || null, username: curr.local && curr.local.username || null },
            current_progress_percent: percent,
            next_user: job.nextUser,
            cancel_after_current: !!job.cancelAfterCurrent,
            logs: job.logs.slice(-300)
        });
    });
    server.post('/admin/users/tools/recalculate-shows/cancel', isLoggedIn, async (req, res) => {
        const id = String((req.body && req.body.jobId) || currentShowsJobId || '');
        const job = jobsShows.get(id);
        if (!job) return res.status(404).send({ error: 'No active job' });
        job.cancelAfterCurrent = true;
        return res.status(200).send({ ok: true });
    });

    // User edit page
    server.get('/admin/users/:id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
        try {
            const user = await User.findById(req.params.id).lean();
            if (!user) return res.redirect('/admin/users');
            res.render(templatePath, {
                page_title: "iWatched - Admin",
                page_file: "user_edit",
                page_data: { user, ok: req.query.ok, err: req.query.err },
                user: req.user
            });
        } catch (e) {
            res.redirect('/admin/users');
        }
    });

    // Update user data (no password here)
    server.post('/admin/users/:id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
        try {
            const u = await User.findById(req.params.id);
            if (!u) return res.redirect('/admin/users');

            // Local fields
            if (req.body.username) u.local.username = req.body.username.trim();
            if (req.body.email) u.local.email = req.body.email.trim();

            // Profile basics
            u.profile = u.profile || {};
            if (typeof req.body.description !== 'undefined') u.profile.description = req.body.description;
            if (typeof req.body.birthday !== 'undefined') u.profile.birthday = req.body.birthday;
            if (typeof req.body.custom_url !== 'undefined') u.profile.custom_url = (req.body.custom_url||'');
            if (typeof req.body.visibility !== 'undefined') u.profile.visibility = req.body.visibility;
            u.profile.inactive = (req.body.inactive === 'on' || req.body.inactive === '1' || req.body.inactive === 'true');

            // Flags
            u.profile.flags = u.profile.flags || {};
            u.profile.flags.beta_tester = (req.body.beta_tester === 'on' || req.body.beta_tester === '1' || req.body.beta_tester === 'true');

            // Permissions
            u.permissions = u.permissions || { level: {} };
            u.permissions.level = u.permissions.level || {};
            u.permissions.level.admin = (req.body.is_admin === 'on' || req.body.is_admin === '1' || req.body.is_admin === 'true');

            // Account
            u.account = u.account || {};
            if (req.body.plan) {
                const prevPlan = u.account.plan || 'free';
                const nextPlan = String(req.body.plan);
                u.account.plan = nextPlan;
                if (prevPlan !== 'premium' && nextPlan === 'premium') {
                    u.account.premium_since = new Date();
                    u.account.premium_until = null;
                    try { u.profile.flags.premium = true; } catch(e){}
                } else if (prevPlan === 'premium' && nextPlan !== 'premium') {
                    u.account.premium_until = new Date();
                    try { u.profile.flags.premium = false; } catch(e){}
                }
            }

            await u.save();
            return res.redirect(`/admin/users/${u._id}?ok=1`);
        } catch (e) {
            console.error('Admin update user failed:', e && e.message);
            return res.redirect(`/admin/users/${req.params.id}?err=1`);
        }
    });

    // Reset private key
    server.post('/admin/users/:id([0-9a-fA-F]{24})/reset_key', isLoggedIn, async (req, res) => {
        try {
            await User.updateOne({ _id: req.params.id }, { $set: { 'permissions.user_private_key': hat() } });
        } catch (e) { console.error('Reset key failed:', e && e.message); }
        return res.redirect(`/admin/users/${req.params.id}?ok=1`);
    });

    // Ban + Delete account
    server.post('/admin/users/:id([0-9a-fA-F]{24})/ban_delete', isLoggedIn, async (req, res) => {
        try {
            const u = await User.findById(req.params.id).lean();
            if (!u) return res.redirect('/admin/users');
            const email = u.local && u.local.email ? String(u.local.email) : null;
            // Prefer user's last known session IP
            let ip = null;
            try {
                const lastSession = await UserSession.find({ user_id: u._id }).sort({ last_seen_at: -1 }).limit(1).lean();
                ip = (lastSession && lastSession[0] && lastSession[0].ip) ? String(lastSession[0].ip) : null;
            } catch(_){}
            if (!ip) ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '').toString();
            const hwid = (req.body && req.body.hardware_id) ? String(req.body.hardware_id) : null;
            const reason = (req.body && req.body.reason) ? String(req.body.reason) : '';
            if (!reason || reason.trim()===''){
                return res.redirect(`/admin/users/${req.params.id}?err=Please provide a reason for banning.`);
            }
            // Resolve moderator display name (persona > username)
            let moderator_name = null;
            try {
                const persona = await ModeratorPersona.findOne({ assigned_user_id: req.user._id }).lean();
                if (persona && persona.name) moderator_name = persona.name;
                else if (req.user && req.user.local && req.user.local.username) moderator_name = req.user.local.username;
            } catch(_){}
            if (email) {
                try {
                    await BannedAccount.create({ email, ip, hardware_id: hwid, reason, moderator_id: req.user._id, moderator_name: moderator_name || null, date_banned: new Date() });
                } catch (e) { /* ignore dup */ }
            }
            // Log moderation action pre-delete
            try {
                await ModerationLog.create({ moderator_id: req.user._id, target_user_id: u._id, action_type: 'ban_delete', reason, ip: (req.headers['x-forwarded-for'] || req.ip || '').toString(), user_agent: req.headers['user-agent']||null, metadata: { hwid: hwid || null } });
            } catch(_){}
            await User.deleteOne({ _id: req.params.id });
            return res.redirect('/admin/bans?ok=1');
        } catch (e) {
            console.error('Ban+Delete failed:', e && e.message);
            return res.redirect(`/admin/users/${req.params.id}?err=1`);
        }
    });

    // Delete account without ban (requires reason; logs moderation)
    server.post('/admin/users/:id([0-9a-fA-F]{24})/delete', isLoggedIn, async (req, res) => {
        try {
            const reason = String((req.body && req.body.reason) || '').trim();
            if (!reason) return res.redirect(`/admin/users/${req.params.id}?err=Please provide a reason for deleting.`);
            const u = await User.findById(req.params.id).lean();
            if (!u) return res.redirect('/admin/users');
            try {
                await ModerationLog.create({ moderator_id: req.user._id, target_user_id: u._id, action_type: 'delete_account', reason, ip: (req.headers['x-forwarded-for'] || req.ip || '').toString(), user_agent: req.headers['user-agent']||null });
            } catch(_){}
            await User.deleteOne({ _id: req.params.id });
            return res.redirect('/admin/users?ok=1');
        } catch (e) { console.error('Delete user failed:', e && e.message); return res.redirect(`/admin/users/${req.params.id}?err=1`); }
    });

    // Admin: create new user (for testing)
    server.get('/admin/users/create', isLoggedIn, async (req, res) => {
        const errCode = String(req.query.err || '').trim();
        const username = String(req.query.username || '');
        const email = String(req.query.email || '');
        const rawMsg = String(req.query.msg || '');
        const messages = {
            exists: 'Username or email already exists.',
            banned: 'This email is banned. Remove it from Banned Users to proceed.',
            invalid: 'Username must be 3–24 characters, letters and numbers only.',
            e1: 'Unexpected error while creating the user.'
        };
        const err = errCode ? (messages[errCode] || 'Could not create user.') : null;
        res.render(templatePath, { page_title: 'Admin - Create User', page_file: 'user_create', page_data: { err, err_code: errCode, username, email, msg: rawMsg }, user: req.user });
    });
    server.post('/admin/users/create', isLoggedIn, async (req, res) => {
        try {
            const username = (req.body.username||'').trim();
            const email = (req.body.email||'').trim();
            const password = (req.body.password||'').trim() || 'Password123!';
            if (!username || !email) return res.redirect('/admin/users/create?err=e1');
            // Validate username like public signup
            if (!/^[A-Za-z0-9]+$/.test(username) || username.length < 3 || username.length > 24){
                return res.redirect(`/admin/users/create?err=invalid&username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}`);
            }
            // Case-insensitive duplicate check for username/email
            const rx = (s)=> new RegExp('^'+String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i');
            const exists = await User.findOne({ $or:[ { 'local.username': { $regex: rx(username) } }, { 'local.email': { $regex: rx(email) } } ] }).lean();
            if (exists) return res.redirect(`/admin/users/create?err=exists&username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}`);
            // Banned check
            const escapeRx = (t)=>String(t||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
            const banned = await BannedAccount.findOne({ email: new RegExp('^'+escapeRx(email)+'$', 'i') }).lean();
            if (banned) return res.redirect(`/admin/users/create?err=banned&username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}`);
            const u = new User(); u.initialSignup(username, String(email).toLowerCase(), password);
            try { await u.save(); }
            catch (e) {
                // Duplicate key safety net
                if (e && (e.code === 11000 || (e.message||'').indexOf('E11000') !== -1)){
                    return res.redirect(`/admin/users/create?err=exists&username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}`);
                }
                console.error('Admin create user failed:', e && e.message);
                return res.redirect(`/admin/users/create?err=e1&username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}&msg=${encodeURIComponent(e&&e.message||'')}`);
            }
            return res.redirect(`/admin/users/${u._id}?ok=1`);
        } catch (e) { console.error('Admin create user failed (outer):', e && e.message); return res.redirect(`/admin/users/create?err=e1&username=${encodeURIComponent(req.body.username||'')}&email=${encodeURIComponent(req.body.email||'')}&msg=${encodeURIComponent(e&&e.message||'')}`); }
    });

    // Bans list
    server.get('/admin/bans', isLoggedIn, async (req, res) => {
        let list = await BannedAccount.find({}).sort({ date_banned: -1 }).lean();
        try {
            // Enrich with moderator display name if missing
            const modIds = Array.from(new Set(list.map(b => String(b.moderator_id||'')).filter(Boolean)));
            const users = await User.find({ _id: { $in: modIds } }).select('_id local.username').lean();
            const personas = await ModeratorPersona.find({ assigned_user_id: { $in: modIds } }).select('assigned_user_id name').lean();
            const uMap = new Map(users.map(u => [String(u._id), (u.local && u.local.username) || '']));
            const pMap = new Map(personas.map(p => [String(p.assigned_user_id), p.name]));
            list = list.map(b => Object.assign({}, b, { moderator_label: (b.moderator_name || pMap.get(String(b.moderator_id)) || uMap.get(String(b.moderator_id)) || String(b.moderator_id||'')) }));
        } catch(_){}
        res.render(templatePath, { page_title: 'Admin - Banned Users', page_file: 'bans', page_data: { bans: list, ok: req.query.ok }, user: req.user });
    });
    server.post('/admin/bans/add', isLoggedIn, async (req, res) => {
        try {
            const email = (req.body.email||'').trim(); if (!email) return res.redirect('/admin/bans?err=1');
            await BannedAccount.create({ email, ip: (req.body.ip||'').trim()||null, hardware_id: (req.body.hardware_id||'').trim()||null, reason: (req.body.reason||'').trim(), moderator_id: req.user._id });
            return res.redirect('/admin/bans?ok=1');
        } catch (_) { return res.redirect('/admin/bans?err=1'); }
    });
    server.post('/admin/bans/:id([0-9a-fA-F]{24})/delete', isLoggedIn, async (req, res) => {
        try { await BannedAccount.deleteOne({ _id: req.params.id }); } catch(_){}
        return res.redirect('/admin/bans?ok=1');
    });
}
