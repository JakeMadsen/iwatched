const userService = require('../../services/users');
const UserFriends = require('../../../db/models/userFriends');
const getUser = require('../../middleware/getUser');
const createError = require('http-errors');
const isCorrectUser = require('../../middleware/isCorrectUser');
const enforceProfileVisibility = require('../../middleware/enforceProfileVisibility');
const UserShowTotals = require('../../../db/models/userShowTotals');
const UserMovieTotals = require('../../../db/models/userMovieTotals');
const UserMovie = require('../../../db/models/userMovie');
const User = require('../../../db/models/user');
const UserUrls = require('../../../db/models/userUrls');
const FriendRequests = require('../../../db/models/friendRequests');
const SupportMessages = require('../../../db/models/supportMessages');
const Recommendation = require('../../../db/models/recommendation');
const Report = require('../../../db/models/report');
const UserSession = require('../../../db/models/userSession');
const UserShow = require('../../../db/models/userShow');
const archiver = require('archiver');

async function __buildHeaderStats(u){
    const userId = u && u._id ? u._id : u;
    // Movies (unified)
    let movieTotals = null; try { movieTotals = await UserMovieTotals.findOne({ user_id: userId }).lean(); } catch(_){}
    let moviesCount = 0; try { moviesCount = await UserMovie.countDocuments({ user_id: userId, movie_watched_count: { $gt: 0 } }); } catch(_){}
    const movieMins = movieTotals && typeof movieTotals.total_runtime === 'number' ? movieTotals.total_runtime : 0;
    function minsToText(mins){ mins = Math.max(0, Math.floor(Number(mins||0))); const d=Math.floor(mins/1440); const h=Math.floor((mins%1440)/60); const m=mins%60; return d+" "+(d===1?"day":"days")+" and "+h+" "+(h===1?"hour":"hours")+" and "+m+" minutes"; }
    const movie_watch_time = movieMins ? minsToText(movieMins) : '-';

    // Shows (unified)
    let totals = null; try { totals = await UserShowTotals.findOne({ user_id: userId }).lean(); } catch(_){}
    const showsCount = totals && typeof totals.unique_shows_watched === 'number' ? totals.unique_shows_watched : 0;
    const seasonsCount = totals && typeof totals.total_seasons_watched === 'number' ? totals.total_seasons_watched : 0;
    const episodesCount = totals && typeof totals.total_episodes_watched === 'number' ? totals.total_episodes_watched : 0;
    const showMins = totals && typeof totals.total_runtime === 'number' ? totals.total_runtime : 0;
    const show_watch_time = showMins ? minsToText(showMins) : '-';
    const total_watch_time_text = minsToText((movieMins||0)+(showMins||0));
    return {
        movie_watch_time,
        numberOfMoviesWatched: moviesCount,
        numberOfShowsWatched: showsCount,
        numberOfSeasonsWatched: seasonsCount,
        numberOfEpisodesWatched: episodesCount,
        show_watch_time,
        total_watch_time_text
    };
}


module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');
    const __exportRateLimit = new Map(); // userId -> timestamp ms

    async function __getShowcasesForUser(u){
        try {
            const ShowcaseCatalog = require('../../../db/models/showcaseCatalog');
            const UserShowcase = require('../../../db/models/userShowcase');
            // Seed minimal catalog for recent_timeline if missing
            try {
                const cnt = await ShowcaseCatalog.countDocuments({}).catch(()=>0);
                if (!cnt || cnt === 0){
                    const exists = await ShowcaseCatalog.findOne({ slug: 'recent_timeline' }).lean();
                    if (!exists){
                        const def = new ShowcaseCatalog({ slug: 'recent_timeline', title: 'Recent Timeline', description: 'Show a grid of your most recent activity: watched, saved, or favourited movies and shows. Configure to show only movies, only shows, mixed, or favourited only.', tier: 'free', max_instances: 3, active: true, config_schema: { mode: { type: 'enum', values: ['mixed','movies_only','shows_only','favorited_only'], default: 'mixed' } } });
                        await def.save();
                    }
                }
            } catch(_){}
            const catalog = await ShowcaseCatalog.find({ active: true }).lean();
            const catMap = new Map((catalog||[]).map(c => [String(c.slug), c]));
            let list = await UserShowcase.find({ user_id: u._id, enabled: true }).sort({ order: 1, _id: 1 }).lean();
            if (!list || list.length === 0){
                try {
                    const seed = new UserShowcase({ user_id: u._id, slug: 'recent_timeline', order: 0, config: { mode: 'mixed' }, enabled: true });
                    await seed.save();
                    list = [ seed.toObject() ];
                } catch(_){}
            }
            const out = (list||[]).filter(it => catMap.has(String(it.slug))).map(it => {
                const cfg = (function(cfg){
                    try {
                        cfg = cfg||{}; const m = String(cfg.mode||'mixed');
                        const count = (parseInt(cfg.count,10)===6?6:12);
                        if (it.slug==='recent_timeline') return { mode: ['mixed','movies_only','shows_only'].includes(m) ? m : 'mixed', count };
                        if (it.slug==='favorite_person') return { mode: (m==='director'?'director':'actor'), person_id: String(cfg.person_id||''), note: String(cfg.note||'') };
                        if (it.slug==='favorite_title') return { mode: (m==='show'?'show':'movie'), tmd_id: String(cfg.tmd_id||''), note: String(cfg.note||'') };
                        return cfg;
                    } catch(_) { return cfg||{}; }
                })(it.config);
                let baseTitle = ((catMap.get(String(it.slug)) || {}).title) || it.slug;
                if (it.slug === 'recent_timeline'){
                    if (cfg.mode === 'movies_only') baseTitle = 'Recently Added Movies';
                    else if (cfg.mode === 'shows_only') baseTitle = 'Recently Added Shows';
                }
                return { slug: it.slug, order: it.order || 0, enabled: !!it.enabled, config: cfg, title: baseTitle };
            }).sort((a,b)=> (a.order||0) - (b.order||0));

            // Resolve data for favorite_* showcases (server-side fetch for display)
            const Movie = require('../../../db/models/movie');
            const Show = require('../../../db/models/show');
            const MovieDb = require('moviedb-promise');
            const tmdb = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');
            async function enrichOne(sc){
                try {
                    if (sc.slug === 'favorite_title'){
                        const id = sc.config && sc.config.tmd_id; if (!id) return sc;
                        if (sc.config.mode === 'movie'){
                            let m = await Movie.findOne({ tmd_id: String(id) }).lean().catch(()=>null);
                            if (!m){ try { const info = await tmdb.movieInfo(id); m = { tmd_id: id, movie_title: info && (info.title||info.name||''), poster_path: info && info.poster_path, tagline: info && info.tagline, overview: info && info.overview }; } catch(_){} }
                            sc.data = { kind: 'movie', id: id, title: (m && (m.movie_title||m.title)) || '', poster: m && m.poster_path, description: (m && (m.tagline||m.overview)) || '' };
                        } else {
                            let s = await Show.findOne({ tmd_id: String(id) }).lean().catch(()=>null);
                            if (!s){ try { const info = await tmdb.tvInfo(id); s = { tmd_id: id, show_title: info && info.name, poster_path: info && info.poster_path, overview: info && info.overview }; } catch(_){} }
                            sc.data = { kind: 'show', id: id, title: (s && (s.show_title||s.name)) || '', poster: s && s.poster_path, description: (s && s.overview) || '' };
                        }
                    } else if (sc.slug === 'favorite_person'){
                        const pid = sc.config && sc.config.person_id; if (!pid) return sc;
                        let p = null; try { p = await tmdb.personInfo(pid); } catch(_){}
                        sc.data = { id: pid, name: (p && p.name) || '', profile: p && p.profile_path, description: (p && p.biography) || '' };
                    } else if (sc.slug === 'favorite_movies'){
                        const ids = Array.isArray(sc.config && sc.config.items) ? sc.config.items.slice(0,6) : [];
                        const Movie = require('../../../db/models/movie');
                        const items = [];
                        for (const id of ids){
                            const sid = String((id && (id.id||id)) || ''); if (!sid) continue;
                            let m = await Movie.findOne({ tmd_id: sid }).lean().catch(()=>null);
                            if (!m){ try { const info = await tmdb.movieInfo(sid); m = { tmd_id: sid, movie_title: info && (info.title||info.name||''), poster_path: info && info.poster_path }; } catch(_){} }
                            items.push({ id: sid, title: (m && (m.movie_title||m.title)) || '', poster: m && m.poster_path, kind: 'movie' });
                        }
                        sc.data = { items };
                    } else if (sc.slug === 'favorite_actors'){
                        const ids2 = Array.isArray(sc.config && sc.config.items) ? sc.config.items.slice(0,6) : [];
                        const items2 = [];
                        for (const pid of ids2){
                            const sid = String((pid && (pid.id||pid)) || ''); if (!sid) continue;
                            let p = null; try { p = await tmdb.personInfo(sid); } catch(_){}
                            items2.push({ id: sid, title: (p && p.name) || '', poster: p && p.profile_path, kind: 'person' });
                        }
                        sc.data = { items: items2 };
                    } else if (sc.slug === 'favorite_shows'){
                        const ids3 = Array.isArray(sc.config && sc.config.items) ? sc.config.items.slice(0,6) : [];
                        const Show = require('../../../db/models/show');
                        const items3 = [];
                        for (const id of ids3){
                            const sid = String((id && (id.id||id)) || ''); if (!sid) continue;
                            let s = await Show.findOne({ tmd_id: sid }).lean().catch(()=>null);
                            if (!s){ try { const info = await tmdb.tvInfo(sid); s = { tmd_id: sid, show_title: info && info.name, poster_path: info && info.poster_path }; } catch(_){} }
                            items3.push({ id: sid, title: (s && (s.show_title||s.name)) || '', poster: s && s.poster_path, kind: 'show' });
                        }
                        sc.data = { items: items3 };
                    } else if (sc.slug === 'my_badges'){
                        try {
                            const Badge = require('../../../db/models/badge');
                            const count = parseInt((sc.config && sc.config.count) || 12, 10);
                            const owned = Array.isArray(res.locals.user && res.locals.user.profile && res.locals.user.profile.user_badges)
                                ? (res.locals.user.profile.user_badges || [])
                                : [];
                            const sel = Array.isArray(sc.config && sc.config.items) ? sc.config.items.slice(0, count) : [];
                            const items = [];
                            if (sel.length){
                                for (const id of sel){
                                    try { const bd = await Badge.findById(id).lean(); if (bd) items.push({ id: String(bd._id), title: bd.title, icon: bd.icon ? ('/static/style/img/badges/' + bd.icon) : null }); } catch(_){}
                                }
                            } else {
                                for (const b of owned.slice(0, count)){
                                    try { const bd = await Badge.findById(b.badge_id).lean(); if (bd) items.push({ id: String(bd._id), title: bd.title, icon: bd.icon ? ('/static/style/img/badges/' + bd.icon) : null }); } catch(_){}
                                }
                            }
                            sc.data = { items };
                        } catch(_){}
                    }
                } catch(_){}
                return sc;
            }
            const resolved = [];
            for (const sc of out){ resolved.push(await enrichOne(sc)); }
            return resolved;
        } catch(_) { return []; }
    }

    server.get('/:id', getUser, enforceProfileVisibility, async (req, res, next) => {

        if (res.locals.user == null)
            return next('route')

        const headerStats = await __buildHeaderStats(res.locals.user);

        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();

        const showcases = await __getShowcasesForUser(res.locals.user);

        // Build badges catalog for profile page as well (used as fallback for My Badges showcase)
        let user_badges_catalog = [];
        try {
            const Badge = require('../../../db/models/badge');
            const owned = Array.isArray(res.locals.user && res.locals.user.profile && res.locals.user.profile.user_badges)
                ? (res.locals.user.profile.user_badges || [])
                : [];
            for (const b of owned){
                try {
                    const bd = await Badge.findById(b.badge_id).lean();
                    if (bd) user_badges_catalog.push({
                        id: String(bd._id),
                        title: bd.title,
                        icon: bd.icon ? ('/static/style/img/badges/' + bd.icon) : null
                    });
                } catch(_){}
            }
        } catch(_){}

        res.render('public assets/template.ejs', {
            page_title: "iWatched - Home",
            page_file: "profile",
            page_subFile: "main",
            page_data: Object.assign({
                user: res.locals.user,
                showcases: showcases,
                friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0,
                user_badges_catalog
            }, headerStats),
            user: req.user
        });
    });

    // Shortcut: /user -> /:slug (same page as /:id)
    server.get('/user', async (req, res) => {
        try {
            if (!req.user) return res.redirect('/login');
            const slug = (req.user && req.user.profile && req.user.profile.custom_url) ? req.user.profile.custom_url : String(req.user._id);
            return res.redirect('/' + slug);
        } catch(_) { return res.redirect('/login'); }
    });

    // Personalize page (same user space: /:id/personalize)
    server.get('/:id/personalize', getUser, isCorrectUser, async (req, res) => {
        try {
            if (!res.locals.user) return res.redirect('/login');
            const ShowcaseCatalog = require('../../../db/models/showcaseCatalog');
            const headerStats = await __buildHeaderStats(res.locals.user);
            // Ensure catalog seed (recent timeline + favorite person/title)
            try {
                const cnt = await ShowcaseCatalog.countDocuments({}).catch(()=>0);
                async function ensureOne(slug, doc){ const ex = await ShowcaseCatalog.findOne({ slug }).lean(); if (!ex) { const x = new ShowcaseCatalog(doc); await x.save(); } }
                if (!cnt || cnt === 0){
                    await ensureOne('recent_timeline', { slug: 'recent_timeline', title: 'Recent Timeline', description: 'Show a grid of your most recent activity: watched, saved, or favourited movies and shows. Configure to show only movies, only shows, mixed, or favourited only.', tier: 'free', max_instances: 3, active: true, config_schema: { mode: { type: 'enum', values: ['mixed','movies_only','shows_only'], default: 'mixed' }, count: { type:'enum', values:[6,12], default:12 } } });
                    await ensureOne('favorite_person', { slug: 'favorite_person', title: 'Favorite Person', description: 'Highlight an actor or director you love with a short note.', tier: 'free', max_instances: 1, active: true, config_schema: { mode: { type:'enum', values:['actor','director'], default:'actor' }, person_id: { type:'string', default:'' }, note: { type:'string', default:'' } } });
                    await ensureOne('favorite_title', { slug: 'favorite_title', title: 'Favorite Title', description: 'Spotlight a favorite movie or show with a personal note.', tier: 'free', max_instances: 1, active: true, config_schema: { mode: { type:'enum', values:['movie','show'], default:'movie' }, tmd_id: { type:'string', default:'' }, note: { type:'string', default:'' } } });
                    await ensureOne('favorite_movies', { slug:'favorite_movies', title:'My Favorite Movies', description:'Pick up to six favorite movies to showcase.', tier:'free', max_instances:1, active:true, config_schema:{ items:{ type:'array', of:'movie_id', max:6 } } });
                    await ensureOne('favorite_actors', { slug:'favorite_actors', title:'My Favorite Actors', description:'Pick up to six favorite actors to showcase.', tier:'free', max_instances:1, active:true, config_schema:{ items:{ type:'array', of:'person_id', max:6 } } });
                    await ensureOne('my_badges', { slug:'my_badges', title:'My Badges', description:'Show up to twelve of your earned badges.', tier:'free', max_instances:1, active:true, config_schema:{ count:{ type:'enum', values:[6,12], default:12 } } });
                    await ensureOne('favorite_shows', { slug:'favorite_shows', title:'My Favorite Shows', description:'Pick up to six favorite shows to showcase.', tier:'free', max_instances:1, active:true, config_schema:{ items:{ type:'array', of:'show_id', max:6 } } });
                } else {
                    // Ensure individual slugs in case catalog exists from earlier deploy
                    await ensureOne('recent_timeline', { slug: 'recent_timeline', title: 'Recent Timeline', description: 'Show a grid of your most recent activity: watched, saved, or favourited movies and shows. Configure to show only movies, only shows, mixed, or favourited only.', tier: 'free', max_instances: 3, active: true, config_schema: { mode: { type: 'enum', values: ['mixed','movies_only','shows_only'], default: 'mixed' }, count: { type:'enum', values:[6,12], default:12 } } });
                    await ensureOne('favorite_person', { slug: 'favorite_person', title: 'Favorite Person', description: 'Highlight an actor or director you love with a short note.', tier: 'free', max_instances: 1, active: true, config_schema: { mode: { type:'enum', values:['actor','director'], default:'actor' }, person_id: { type:'string', default:'' }, note: { type:'string', default:'' } } });
                    await ensureOne('favorite_title', { slug: 'favorite_title', title: 'Favorite Title', description: 'Spotlight a favorite movie or show with a personal note.', tier: 'free', max_instances: 1, active: true, config_schema: { mode: { type:'enum', values:['movie','show'], default:'movie' }, tmd_id: { type:'string', default:'' }, note: { type:'string', default:'' } } });
                    await ensureOne('favorite_movies', { slug:'favorite_movies', title:'My Favorite Movies', description:'Pick up to six favorite movies to showcase.', tier:'free', max_instances:1, active:true, config_schema:{ items:{ type:'array', of:'movie_id', max:6 } } });
                    await ensureOne('favorite_actors', { slug:'favorite_actors', title:'My Favorite Actors', description:'Pick up to six favorite actors to showcase.', tier:'free', max_instances:1, active:true, config_schema:{ items:{ type:'array', of:'person_id', max:6 } } });
                    await ensureOne('my_badges', { slug:'my_badges', title:'My Badges', description:'Show up to twelve of your earned badges.', tier:'free', max_instances:1, active:true, config_schema:{ count:{ type:'enum', values:[6,12], default:12 } } });
                    await ensureOne('favorite_shows', { slug:'favorite_shows', title:'My Favorite Shows', description:'Pick up to six favorite shows to showcase.', tier:'free', max_instances:1, active:true, config_schema:{ items:{ type:'array', of:'show_id', max:6 } } });
                }
                // Ensure newer showcase types as well
                await ensureOne('custom_text', { slug:'custom_text', title:'Custom Text', description:'Add a short text block to your profile. Supports line breaks and links.', tier:'free', max_instances:1, active:true, config_schema:{ text:{ type:'string', default:'' } } });
            } catch(_){}
            const [catalog] = await Promise.all([
                ShowcaseCatalog.find({ active: true }).lean()
            ]);
            // Reuse enrichment logic so favorite_* previews have data on refresh
            const selection = await __getShowcasesForUser(res.locals.user);
            // Build badges catalog for picker
            let user_badges_catalog = [];
            try {
                const Badge = require('../../../db/models/badge');
                const owned = Array.isArray(res.locals.user && res.locals.user.profile && res.locals.user.profile.user_badges)
                    ? (res.locals.user.profile.user_badges || [])
                    : [];
                for (const b of owned){
                    try { const bd = await Badge.findById(b.badge_id).lean(); if (bd) user_badges_catalog.push({ id: String(bd._id), title: bd.title, icon: bd.icon ? ('/static/style/img/badges/' + bd.icon) : null }); } catch(_){}
                }
            } catch(_){}
            res.render('public assets/template.ejs', {
                page_title: 'iWatched - Personalize Profile',
                page_file: 'user_personalize',
                page_data: Object.assign({ user: res.locals.user, showcases_catalog: catalog, showcases_selection: selection, user_badges_catalog }, headerStats),
                user: req.user
            });
        } catch(_) { return res.redirect('/login'); }
    });

    // JSON endpoint to de-activate account from settings UI
    server.post('/:id/settings/deactivate', getUser, isCorrectUser, async (req, res) => {
        try {
            if (!res.locals.user) return res.status(404).end();
            const userDoc = await User.findById(res.locals.user._id);
            if (!userDoc) return res.status(404).json({ ok:false });
            try { userDoc.profile = userDoc.profile || {}; } catch(_){}
            userDoc.profile.inactive = true;
            await userDoc.save();
            return res.json({ ok:true });
        } catch (e) {
            return res.status(500).json({ ok:false, message:'Failed to de-activate' });
        }
    });

    server.get('/:id/friends', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        const friends = friendsDoc ? friendsDoc.friends : [];
        const headerStats2 = await __buildHeaderStats(res.locals.user);
        // Enrich to show immediately on first paint
        const enriched = await Promise.all((friends || []).map(async f => {
            try {
                const u = await userService.getOne(f.user_id);
                if (!u) return null;
                return {
                    id: String(u._id),
                    username: (u.local && u.local.username) || '',
                    slug: (u.profile && u.profile.custom_url) || null,
                    avatar: (u.profile && u.profile.profile_image)
                        ? `/static/style/img/profile_images/users/${u._id}/${u.profile.profile_image}`
                        : null,
                    since: f.since
                }
            } catch (_) { return null; }
        }));
        const friendsList = enriched.filter(Boolean);
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Friends",
            page_file: "profile",
            page_subFile: "friends",
            page_data: Object.assign({ user: res.locals.user, friends: friendsList, friends_count: friendsList.length }, headerStats2),
            user: req.user
        });
    });

    server.get('/:id/watched/:type', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

        let watchedTime;
        let amountOfMovies;
        let type = req.params.type;


        if(type == "movies"){
            try {
                const mt = await UserMovieTotals.findOne({ user_id: res.locals.user._id }).lean();
                watchedTime = (mt && typeof mt.total_runtime === 'number') ? mt.total_runtime : 0;
            } catch(_) { watchedTime = 0; }
            try {
                amountOfMovies = await UserMovie.countDocuments({ user_id: res.locals.user._id, movie_watched_count: { $gt: 0 } });
            } catch(_) { amountOfMovies = 0; }
        } else if (type == 'shows') {
            try {
                const UserShow = require('../../../db/models/userShow');
                const totals = await UserShowTotals.findOne({ user_id: res.locals.user._id }).lean();
                watchedTime = (totals && typeof totals.total_runtime === 'number') ? totals.total_runtime : 0;
                const entries = await UserShow.find({
                    user_id: res.locals.user._id,
                    $or: [
                        { show_watched_count: { $gt: 0 } },
                        { show_watched: { $ne: null } },
                        { seasons: { $elemMatch: { date_completed: { $ne: null } } } }
                    ]
                }).lean();
                amountOfMovies = Array.from(new Set((entries||[]).map(e => String(e.show_id)))).length;
            } catch (_) { watchedTime = 0; amountOfMovies = 0; }
        }

        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        const headerStats3 = await __buildHeaderStats(res.locals.user);
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Home",
            page_file: "profile",
            page_subFile: "watched",
            page_data: Object.assign({ user: res.locals.user, watchedTime: watchedTime, amountOfMovies: amountOfMovies, type: type, friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0 }, headerStats3),
            user: req.user
        });
    });

    server.get('/:id/favourite/:type', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null) return next('route');
        try {
            const tab = req.params.type && String(req.params.type).toLowerCase()==='shows' ? 'shows' : 'movies';
            const basePath = (res.locals.user.profile && res.locals.user.profile.custom_url) ? ('/'+res.locals.user.profile.custom_url) : ('/'+res.locals.user._id);
            return res.redirect(basePath + '/favourites?tab=' + tab);
        } catch(_) { return next('route'); }
    });

    server.get('/:id/saved/:type', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null) return next('route');
        try {
            const tab = req.params.type && String(req.params.type).toLowerCase()==='shows' ? 'shows' : 'movies';
            const basePath = (res.locals.user.profile && res.locals.user.profile.custom_url) ? ('/'+res.locals.user.profile.custom_url) : ('/'+res.locals.user._id);
            return res.redirect(basePath + '/bookmarked?tab=' + tab);
        } catch(_) { return next('route'); }
    });

    // Consolidated pages
    server.get('/:id/favourites', getUser, enforceProfileVisibility, async (req, res) => {
        if (res.locals.user == null) return;
        const headerStats = await __buildHeaderStats(res.locals.user);
        const friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        const tab = (req.query.tab && String(req.query.tab).toLowerCase()==='shows') ? 'shows' : 'movies';
        res.render('public assets/template.ejs', {
            page_title: 'iWatched - Favourites',
            page_file: 'profile',
            page_subFile: 'favourites',
            page_data: Object.assign({ user: res.locals.user, media_tab: tab, friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0 }, headerStats),
            user: req.user
        });
    });

    server.get('/:id/bookmarked', getUser, enforceProfileVisibility, async (req, res) => {
        if (res.locals.user == null) return;
        const headerStats = await __buildHeaderStats(res.locals.user);
        const friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        const tab = (req.query.tab && String(req.query.tab).toLowerCase()==='shows') ? 'shows' : 'movies';
        res.render('public assets/template.ejs', {
            page_title: 'iWatched - Bookmarked',
            page_file: 'profile',
            page_subFile: 'bookmarked',
            page_data: Object.assign({ user: res.locals.user, media_tab: tab, friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0 }, headerStats),
            user: req.user
        });
    });

    server.get('/:id/settings', getUser, isCorrectUser, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        // Load user's badges for settings dropdown
        let badgesDetailed = [];
        try {
            const Badge = require('../../../db/models/badge');
            const badges = (res.locals.user.profile && res.locals.user.profile.user_badges) || [];
            const ids = badges.map(b => b.badge_id).filter(Boolean);
            if (ids.length) {
                const details = await Badge.find({ _id: { $in: ids } }).lean();
                const map = new Map(details.map(d => [String(d._id), d]));
                badgesDetailed = badges.map(b => {
                    const d = map.get(String(b.badge_id));
                    return {
                        id: String(b.badge_id),
                        title: (d && d.title) || 'Badge',
                        icon: d && d.icon ? ('/static/style/img/badges/' + d.icon) : null,
                        level: b.level || 'single'
                    };
                });
            }
        } catch (_) {}
        const headerStats6 = await __buildHeaderStats(res.locals.user);
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Home",
            page_file: "profile",
            page_subFile: "settings",
            page_data: Object.assign({ user: res.locals.user, friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0, badges: badgesDetailed }, headerStats6),
            user: req.user
        });
    });

    // Stats page (design/dummy data for now)
    server.get('/:id/stats', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null) return next('route');
                // Gather live counters for profile_stats cards
        let moviesTime = 0; let showsTime = 0; let numberOfMovies = 0; let numberOfShows = 0; let episodesCount = 0;
        try {
            const mt = await UserMovieTotals.findOne({ user_id: res.locals.user._id }).lean();
            moviesTime = (mt && typeof mt.total_runtime === 'number') ? mt.total_runtime : 0;
            numberOfMovies = await UserMovie.countDocuments({ user_id: res.locals.user._id, movie_watched_count: { $gt: 0 } });
        } catch (_) {}
        try {
            const st = await UserShowTotals.findOne({ user_id: res.locals.user._id }).lean();
            numberOfShows = (st && typeof st.unique_shows_watched === 'number') ? st.unique_shows_watched : 0;
            showsTime = (st && typeof st.total_runtime === 'number') ? st.total_runtime : 0;
        } catch (_) {}
        const dummy = {
            most_watched_actor: { name: 'Alex Mercer', count: 42 },
            most_seen_director: { name: 'Jamie Lin', count: 17 },
            most_watched_genre: { name: 'Drama', count: 88 },
            most_watched_decade: { label: '1990s', count: 36 },
            top10_actors: [
                { name: 'Alex Mercer', count: 42 }, { name: 'Sam Vega', count: 38 }, { name: 'Rin Okada', count: 35 },
                { name: 'Maya Torres', count: 33 }, { name: 'Leo Park', count: 31 }, { name: 'Keira Ames', count: 29 },
                { name: 'Owen Hale', count: 28 }, { name: 'Irene Cho', count: 27 }, { name: 'Tariq Aziz', count: 26 }, { name: 'Nia Patel', count: 25 }
            ],
            top10_directors: [
                { name: 'Jamie Lin', count: 17 }, { name: 'Arun Desai', count: 15 }, { name: 'Clara Wilde', count: 14 },
                { name: 'Diego Ramos', count: 14 }, { name: 'H. Takeda', count: 13 }, { name: 'Sofia Marin', count: 12 },
                { name: 'Noah Quinn', count: 12 }, { name: 'Y. Chen', count: 11 }, { name: 'E. Novak', count: 11 }, { name: 'M. Duarte', count: 10 }
            ],
            top10_genres: [
                { name: 'Drama', count: 88 }, { name: 'Action', count: 72 }, { name: 'Comedy', count: 65 },
                { name: 'Thriller', count: 52 }, { name: 'Sciâ€‘Fi', count: 47 }, { name: 'Crime', count: 45 },
                { name: 'Romance', count: 39 }, { name: 'Adventure', count: 33 }, { name: 'Animation', count: 26 }, { name: 'Horror', count: 24 }
            ],
            rewatches_logged: 12,
            oldest_movie_watched: { title: 'Metropolis', year: 1927 },
            newest_release_watched: { title: 'Starfall', year: 2025 },
            genre_diversity: { unique: 12, total: 143, ratio: Math.round((12/143)*100) },
            old_vs_new: { pre2000: 58, post2000: 85 }
        };

        const headerStats7 = await __buildHeaderStats(res.locals.user);
        res.render('public assets/template.ejs', {
            page_title: 'iWatched - Stats',
            page_file: 'profile',
            page_subFile: 'stats_page',
            page_data: Object.assign({ user: res.locals.user, stats: dummy }, headerStats7),
            user: req.user
        });
    });

    // Badges page
    server.get('/user/badges', async (req, res) => {
        try {
            if (!req.user) return res.redirect('/login');
            const slug = (req.user && req.user.profile && req.user.profile.custom_url) ? req.user.profile.custom_url : String(req.user._id);
            return res.redirect('/' + slug + '/badges');
        } catch (_) { return res.redirect('/login'); }
    });

    // Stats page shortcut: /user/stats -> /:slug/stats
    server.get('/user/stats', async (req, res) => {
        try {
            if (!req.user) return res.redirect('/login');
            const slug = (req.user && req.user.profile && req.user.profile.custom_url)
                ? req.user.profile.custom_url
                : String(req.user._id);
            return res.redirect('/' + slug + '/stats');
        } catch (_) { return res.redirect('/login'); }
    });
    server.get('/:id/badges', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null) return next('route');
        const Badge = require('../../../db/models/badge');
        const u = res.locals.user;
        const badges = Array.isArray(u.profile && u.profile.user_badges) ? u.profile.user_badges : [];
        const ids = badges.map(b => b.badge_id).filter(Boolean);
        let details = [];
        try { details = await Badge.find({ _id: { $in: ids } }).lean(); } catch (_) { details = []; }
        const map = new Map(details.map(d => [String(d._id), d]));
        const enriched = badges.map(b => {
            const d = map.get(String(b.badge_id));
            return {
                id: String(b.badge_id),
                level: b.level || 'single',
                awarded_at: b.awarded_at || null,
                title: d ? d.title : 'Badge',
                description: d ? d.description : '',
                icon: d && d.icon ? ('/static/style/img/badges/' + d.icon) : null
            };
        });
        const headerStats = await __buildHeaderStats(u);
        res.render('public assets/template.ejs', {
            page_title: 'iWatched - Badges',
            page_file: 'profile',
            page_subFile: 'badges',
            page_data: Object.assign({ user: u, badges: enriched }, headerStats),
            user: req.user
        });
    });

    server.post('/:id/settings', getUser, isCorrectUser, async (req, res) => {    
        const wantsJson = (String(req.query.ajax||'') === '1')
            || ((req.headers['accept']||'').indexOf('application/json') !== -1)
            || (req.get && req.get('X-Requested-With') === 'XMLHttpRequest');

        // Enforce per-plan upload size (5MB free, 8MB premium)
        try {
            const plan = (req.user && req.user.account && req.user.account.plan) || 'free';
            const maxFree = 5 * 1024 * 1024; // 5MB
            const maxPremium = 8 * 1024 * 1024; // 8MB
            const max = (String(plan).toLowerCase() === 'premium') ? maxPremium : maxFree;
            const files = req.files || {};
            const toCheck = [
                { f: files.profilePictureFile, name: 'Avatar' },
                { f: files.profileBannerFile, name: 'Banner' }
            ];
            for (const item of toCheck) {
                const f = item && item.f;
                if (f && typeof f.size === 'number' && f.size > max) {
                    const mb = (max/1024/1024)|0;
                    const msg = `${item.name} is too large. Max ${mb}MB for your plan.`;
                    if (wantsJson) return res.status(400).json({ ok:false, error: 'file_too_large', message: msg, limit_bytes: max });

                    // Re-render settings with error banner
                    let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
                    let badgesDetailed = [];
                    try {
                        const Badge = require('../../../db/models/badge');
                        const badges = (res.locals.user.profile && res.locals.user.profile.user_badges) || [];
                        const ids = badges.map(b => b.badge_id).filter(Boolean);
                        if (ids.length) {
                            const details = await Badge.find({ _id: { $in: ids } }).lean();
                            const map = new Map(details.map(d => [String(d._id), d]));
                            badgesDetailed = badges.map(b => {
                                const d = map.get(String(b.badge_id));
                                return { id: String(b.badge_id), title: (d && d.title) || 'Badge', icon: d && d.icon ? ('/static/style/img/badges/' + d.icon) : null, level: b.level || 'single' };
                            });
                        }
                    } catch (_) {}
                    const headerStatsX = await __buildHeaderStats(res.locals.user);
                    return res.status(413).render('public assets/template.ejs', {
                        page_title: "iWatched - Home",
                        page_file: "profile",
                        page_subFile: "settings",
                        page_data: Object.assign({ user: res.locals.user, friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0, badges: badgesDetailed, upload_error: msg, upload_limit_bytes: max }, headerStatsX),
                        user: req.user
                    });
                }
            }
        } catch (e) { /* ignore size check errors and continue */ }

        await userService
        .saveUser(req.params.id, req.body, req.files)
        .then(userUpdated => {
            if (wantsJson){
                try {
                    const prefs = (userUpdated && userUpdated.profile && userUpdated.profile.preferences) || {};
                    return res.json({ ok:true, preferences: prefs });
                } catch (_) { return res.json({ ok:true }); }
            }
            res.redirect('/'+userUpdated._id)
        })
        .catch(async error => {
            console.log("server.post/:id/settings - catched error")
            console.log(error)
            const message = (error && (error.custom_error || error.message)) || null;
            if (wantsJson) return res.status(400).json({ ok:false, error: error && error.code || 'save_failed', message: message || 'Failed to save settings' });
            // Re-render with friendly error if available
            try {
                let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
                let badgesDetailed = [];
                try {
                    const Badge = require('../../../db/models/badge');
                    const badges = (res.locals.user.profile && res.locals.user.profile.user_badges) || [];
                    const ids = badges.map(b => b.badge_id).filter(Boolean);
                    if (ids.length) {
                        const details = await Badge.find({ _id: { $in: ids } }).lean();
                        const map = new Map(details.map(d => [String(d._id), d]));
                        badgesDetailed = badges.map(b => {
                            const d = map.get(String(b.badge_id));
                            return { id: String(b.badge_id), title: (d && d.title) || 'Badge', icon: d && d.icon ? ('/static/style/img/badges/' + d.icon) : null, level: b.level || 'single' };
                        });
                    }
                } catch (_) {}
                const headerStatsY = await __buildHeaderStats(res.locals.user);
                return res.status(400).render('public assets/template.ejs', {
                    page_title: "iWatched - Home",
                    page_file: "profile",
                    page_subFile: "settings",
                    page_data: Object.assign({ user: res.locals.user, friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0, badges: badgesDetailed, upload_error: message || 'Failed to process image' }, headerStatsY),
                    user: req.user
                });
            } catch (_) {
                throw new Error({error: error, custom_error: "Something went wrong with saving settings"})
            }
        })
    });

    server.post('/:id/deactivate', getUser, isCorrectUser, async (req, res) => {
        try {
            const userId = req.user && req.user._id;
            if (!userId) return res.redirect('/login');
            console.log(`User (${userId}) de-activated their profile`)
            const userDoc = await User.findById(userId);
            if (!userDoc) return res.redirect('/');
            try { userDoc.profile = userDoc.profile || {}; } catch(_){}
            userDoc.profile.inactive = true;
            await userDoc.save();
            res.redirect('/');
        } catch (e) {
            res.redirect('/');
        }
    });

    server.post('/:id/delete', getUser, isCorrectUser, async (req, res) => {
        // Legacy endpoint: perform hard delete without password (not exposed in UI)
        // Prefer POST /:id/settings/delete which enforces password.
        try {
            const userId = req.user && req.user._id;
            if (!userId) return res.redirect('/login');
            console.log(`User (${userId}) deleted their profile via legacy endpoint`);
            await Promise.all([
                UserMovie.deleteMany({ user_id: userId }),
                UserMovieTotals.deleteOne({ user_id: userId }),
                UserShow.deleteMany({ user_id: userId }),
                UserShowTotals.deleteOne({ user_id: userId }),
                UserFriends.deleteOne({ user_id: userId }),
                FriendRequests.deleteMany({ $or: [ { from_user_id: String(userId) }, { to_user_id: String(userId) } ] }),
                Recommendation.deleteMany({ $or: [ { sender_id: userId }, { receiver_id: userId } ] }),
                SupportMessages.deleteMany({ opened_by: userId }),
                UserSession.deleteMany({ user_id: userId }),
                UserUrls.deleteMany({ user_id: userId })
            ]);
            await User.deleteOne({ _id: userId });
            try { req.logout && req.logout(); } catch (_) {}
            return res.redirect('/');
        } catch (e) {
            console.error('Legacy delete error:', e);
            return res.redirect('/');
        }
    });

    // GDPR export: returns a zip with Profile_Data.json, Movie_Data.json, Show_Data.json
    server.get('/:id/settings/export', getUser, isCorrectUser, async (req, res) => {
        try {
            if (!res.locals.user) return res.status(404).end();
            const uid = String(res.locals.user._id);
            const now = Date.now();
            const last = __exportRateLimit.get(uid) || 0;
            const oneDay = 24 * 60 * 60 * 1000;
            if ((now - last) < oneDay) {
                const waitMins = Math.ceil((oneDay - (now - last)) / 60000);
                return res.status(429).json({ ok: false, code: 'rate_limited', message: `Please wait ${waitMins} minute(s) before requesting another export.` });
            }
            __exportRateLimit.set(uid, now);

            const userId = res.locals.user._id;

            const [
                userDoc,
                userUrls,
                userFriends,
                frOut,
                frIn,
                supportCases,
                recSent,
                recRecv,
                reportsFiled,
                sessions,
                userMovies,
                movieTotals,
                userShows,
                showTotals
            ] = await Promise.all([
                (async () => { try { return await User.findById(userId).lean(); } catch (_) { return null; } })(),
                (async () => { try { return await UserUrls.findOne({ user_id: userId }).lean(); } catch (_) { return null; } })(),
                (async () => { try { return await UserFriends.findOne({ user_id: userId }).lean(); } catch (_) { return null; } })(),
                (async () => { try { return await FriendRequests.find({ from_user_id: String(userId) }).lean(); } catch (_) { return []; } })(),
                (async () => { try { return await FriendRequests.find({ to_user_id: String(userId) }).lean(); } catch (_) { return []; } })(),
                (async () => { try { return await SupportMessages.find({ opened_by: userId }).lean(); } catch (_) { return []; } })(),
                (async () => { try { return await Recommendation.find({ sender_id: userId }).lean(); } catch (_) { return []; } })(),
                (async () => { try { return await Recommendation.find({ receiver_id: userId }).lean(); } catch (_) { return []; } })(),
                (async () => { try { return await Report.find({ reporter_user_id: userId }).lean(); } catch (_) { return []; } })(),
                (async () => { try { return await UserSession.find({ user_id: userId }).lean(); } catch (_) { return []; } })(),
                (async () => { try { return await UserMovie.find({ user_id: userId }).lean(); } catch (_) { return []; } })(),
                (async () => { try { return await UserMovieTotals.findOne({ user_id: userId }).lean(); } catch (_) { return null; } })(),
                (async () => { try { return await UserShow.find({ user_id: userId }).lean(); } catch (_) { return []; } })(),
                (async () => { try { return await UserShowTotals.findOne({ user_id: userId }).lean(); } catch (_) { return null; } })(),
            ]);

            const safeUser = (() => {
                try {
                    if (!userDoc) return null;
                    const copy = JSON.parse(JSON.stringify(userDoc));
                    if (copy.local) copy.local.password = undefined;
                    if (copy.permissions) copy.permissions.user_private_key = undefined;
                    return copy;
                } catch (_) { return null; }
            })();
            const safeSessions = (sessions || []).map(s => {
                const c = Object.assign({}, s);
                delete c.sid;
                return c;
            });

            const profileData = {
                user: safeUser,
                urls: userUrls || null,
                friends: (userFriends && userFriends.friends) || [],
                friend_requests: { outgoing: frOut || [], incoming: frIn || [] },
                support_cases: supportCases || [],
                recommendations: { sent: recSent || [], received: recRecv || [] },
                reports_filed: reportsFiled || [],
                sessions: safeSessions
            };

            const moviesData = { totals: movieTotals || null, movies: userMovies || [] };
            const showsData = { totals: showTotals || null, shows: userShows || [] };

            const fname = `iwatched_export_${String(userId)}_${new Date().toISOString().replace(/[:.]/g,'-')}.zip`;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.on('error', (err) => { try { res.status(500).end(String(err && err.message || err)); } catch (_) {} });
            archive.pipe(res);
            archive.append(Buffer.from(JSON.stringify(profileData, null, 2)), { name: 'Profile_Data.json' });
            archive.append(Buffer.from(JSON.stringify(moviesData, null, 2)), { name: 'Movie_Data.json' });
            archive.append(Buffer.from(JSON.stringify(showsData, null, 2)), { name: 'Show_Data.json' });
            await archive.finalize();
        } catch (e) {
            console.error('Export error:', e);
            try { return res.status(500).json({ ok:false, code:'export_failed', message: 'Failed to generate export' }); } catch (_) {}
        }
    });

    // New permanent delete endpoint (requires password)
    server.post('/:id/settings/delete', getUser, isCorrectUser, async (req, res) => {
        try {
            if (!res.locals.user) return res.status(404).end();
            const userId = res.locals.user._id;
            const password = (req.body && req.body.password) ? String(req.body.password) : '';
            const userDoc = await User.findById(userId);
            if (!userDoc) return res.status(404).json({ ok:false, code:'not_found' });
            if (!password || !userDoc.validPassword(password)) {
                return res.status(401).json({ ok:false, code:'invalid_password', message:'Incorrect password' });
            }

            await Promise.all([
                UserMovie.deleteMany({ user_id: userId }),
                UserMovieTotals.deleteOne({ user_id: userId }),
                UserShow.deleteMany({ user_id: userId }),
                UserShowTotals.deleteOne({ user_id: userId }),
                UserFriends.deleteOne({ user_id: userId }),
                FriendRequests.deleteMany({ $or: [ { from_user_id: String(userId) }, { to_user_id: String(userId) } ] }),
                Recommendation.deleteMany({ $or: [ { sender_id: userId }, { receiver_id: userId } ] }),
                SupportMessages.deleteMany({ opened_by: userId }),
                UserSession.deleteMany({ user_id: userId }),
                UserUrls.deleteMany({ user_id: userId })
            ]);
            await User.deleteOne({ _id: userId });
            try { req.logout && req.logout(); } catch (_) {}
            return res.json({ ok: true });
        } catch (e) {
            console.error('Permanent delete error:', e);
            return res.status(500).json({ ok:false, code:'delete_failed', message:'Failed to delete account' });
        }
    });
}




