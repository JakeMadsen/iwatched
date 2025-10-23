const userService = require('../../services/users');
const UserFriends = require('../../../db/models/userFriends');
const getUser = require('../../middleware/getUser');
const createError = require('http-errors');
const isCorrectUser = require('../../middleware/isCorrectUser');
const enforceProfileVisibility = require('../../middleware/enforceProfileVisibility');
const UserShowTotals = require('../../../db/models/userShowTotals');
const UserMovieTotals = require('../../../db/models/userMovieTotals');
const UserMovie = require('../../../db/models/userMovie');

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

    server.get('/:id', getUser, enforceProfileVisibility, async (req, res, next) => {

        if (res.locals.user == null)
            return next('route')

        const headerStats = await __buildHeaderStats(res.locals.user);

        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "main",
            page_data: Object.assign({
                user: res.locals.user,
                friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0
            }, headerStats),
            user: req.user
        });
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
            page_title: "iWatched.xyz - Friends",
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
            page_title: "iWatched.xyz - Home",
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
            page_title: 'iWatched.xyz - Favourites',
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
            page_title: 'iWatched.xyz - Bookmarked',
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
            page_title: "iWatched.xyz - Home",
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
            page_title: 'iWatched.xyz - Stats',
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
        res.render('public assets/template.ejs', {
            page_title: 'iWatched.xyz - Badges',
            page_file: 'profile',
            page_subFile: 'badges',
            page_data: { user: u, badges: enriched },
            user: req.user
        });
    });

    server.post('/:id/settings', getUser, isCorrectUser, async (req, res) => {    
        await userService
        .saveUser(req.params.id, req.body, req.files)
        .then(userUpdated => {
            res.redirect('/'+userUpdated._id)
        })
        .catch(error => {
            console.log("server.post/:id/settings - catched error")
            console.log(error)
            throw new Error({error: error, custom_error: "Something went wrong with saving settings"})
        })
    });

    server.post('/:id/deactivate', getUser, isCorrectUser, async (req, res) => {
        let user_id = req.user._id;
        console.log(`User (${user_id}) deleted his profile`)

        User.findById(user_id, function (err, user) {
            user.remove(function (err, userUpdated) {
                if (err) return handleError(err);
                res.redirect('/');
            });
        })
    });

    server.post('/:id/delete', getUser, isCorrectUser, async (req, res) => {
        let user_id = req.user._id;
        console.log(`User (${user_id}) deleted his profile`)

        User.findById(user_id, function (err, user) {
            user.remove(function (err, userUpdated) {
                if (err) return handleError(err);
                res.redirect('/');
            });
        })
    });
}




