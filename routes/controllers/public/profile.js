const userService = require('../../services/users');
const UserFriends = require('../../../db/models/userFriends');
const getUser = require('../../middleware/getUser');
const createError = require('http-errors');
const isCorrectUser = require('../../middleware/isCorrectUser');
const enforceProfileVisibility = require('../../middleware/enforceProfileVisibility');


module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');

    server.get('/:id', getUser, enforceProfileVisibility, async (req, res, next) => {

        if (res.locals.user == null)
            return next('route')

        let totalMoviesWatched = await userService.getTimeWatched(res.locals.user._id, "movies")
        let numberOfMoviesWatched = await userService.getWatchedMovies(res.locals.user._id)
                // header stats for profile cards
        let moviesTimeHeader = await userService.getTimeWatched(res.locals.user._id, "movies");
        let showsTimeHeader = await userService.getTimeWatched(res.locals.user._id, "shows");
        let numberOfMoviesHeader = 0; try { const wm = await userService.getWatchedMovies(res.locals.user._id); numberOfMoviesHeader = (wm && Array.isArray(wm.movies_watched)) ? wm.movies_watched.length : 0; } catch(_){}
        let numberOfShowsHeader = 0; try { const UserWatchedShows = require('../../../db/models/userWatchedShows'); const sw = await UserWatchedShows.findOne({ user_id: res.locals.user._id }).lean(); numberOfShowsHeader = (sw && Array.isArray(sw.shows_watched)) ? sw.shows_watched.length : 0; } catch(_){}let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "main",
            page_data: {
                user: res.locals.user,
                movie_watch_time: totalMoviesWatched,
                numberOfMoviesWatched: numberOfMoviesWatched.movies_watched.length,
                friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0
            },
            user: req.user
        });
    });

    server.get('/:id/friends', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

                // header stats for profile cards
        let moviesTimeHeader = await userService.getTimeWatched(res.locals.user._id, "movies");
        let showsTimeHeader = await userService.getTimeWatched(res.locals.user._id, "shows");
        let numberOfMoviesHeader = 0; try { const wm = await userService.getWatchedMovies(res.locals.user._id); numberOfMoviesHeader = (wm && Array.isArray(wm.movies_watched)) ? wm.movies_watched.length : 0; } catch(_){}
        let numberOfShowsHeader = 0; try { const UserWatchedShows = require('../../../db/models/userWatchedShows'); const sw = await UserWatchedShows.findOne({ user_id: res.locals.user._id }).lean(); numberOfShowsHeader = (sw && Array.isArray(sw.shows_watched)) ? sw.shows_watched.length : 0; } catch(_){}let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        const friends = friendsDoc ? friendsDoc.friends : [];
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
            page_data: {
                user: res.locals.user,
                friends: friendsList,
                friends_count: friendsList.length
            },
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
            watchedTime = await userService.getTimeWatched(res.locals.user._id, "movies")
            amountOfMovies = await userService.getWatchedMovies(res.locals.user._id)
            amountOfMovies = amountOfMovies.movies_watched.length
        } else if (type == 'shows') {
            try {
                const UserWatchedShows = require('../../../db/models/userWatchedShows');
                const doc = await UserWatchedShows.findOne({ user_id: res.locals.user._id }).lean();
                watchedTime = (doc && doc.show_watch_time) || 0;
                amountOfMovies = { movies_watched: [] };
                amountOfMovies = (doc && Array.isArray(doc.shows_watched)) ? doc.shows_watched.length : 0;
            } catch (_) { watchedTime = 0; amountOfMovies = 0; }
        }

                // header stats for profile cards
        let moviesTimeHeader = await userService.getTimeWatched(res.locals.user._id, "movies");
        let showsTimeHeader = await userService.getTimeWatched(res.locals.user._id, "shows");
        let numberOfMoviesHeader = 0; try { const wm = await userService.getWatchedMovies(res.locals.user._id); numberOfMoviesHeader = (wm && Array.isArray(wm.movies_watched)) ? wm.movies_watched.length : 0; } catch(_){}
        let numberOfShowsHeader = 0; try { const UserWatchedShows = require('../../../db/models/userWatchedShows'); const sw = await UserWatchedShows.findOne({ user_id: res.locals.user._id }).lean(); numberOfShowsHeader = (sw && Array.isArray(sw.shows_watched)) ? sw.shows_watched.length : 0; } catch(_){}let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "watched",
            page_data: {
                user: res.locals.user,
                watchedTime: watchedTime,
                amountOfMovies: amountOfMovies,
                type: type,
                friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0
            },
            user: req.user
        });
    });

    server.get('/:id/favourite/:type', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')
        let amountOfMovies;

        if(req.params.type == "movies"){
            amountOfMovies = await userService.getFavouritedMovies(res.locals.user._id)
            amountOfMovies = amountOfMovies.movies_favourited.length
        }

                // header stats for profile cards
        let moviesTimeHeader = await userService.getTimeWatched(res.locals.user._id, "movies");
        let showsTimeHeader = await userService.getTimeWatched(res.locals.user._id, "shows");
        let numberOfMoviesHeader = 0; try { const wm = await userService.getWatchedMovies(res.locals.user._id); numberOfMoviesHeader = (wm && Array.isArray(wm.movies_watched)) ? wm.movies_watched.length : 0; } catch(_){}
        let numberOfShowsHeader = 0; try { const UserWatchedShows = require('../../../db/models/userWatchedShows'); const sw = await UserWatchedShows.findOne({ user_id: res.locals.user._id }).lean(); numberOfShowsHeader = (sw && Array.isArray(sw.shows_watched)) ? sw.shows_watched.length : 0; } catch(_){}let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "favourited",
            page_data: {
                user: res.locals.user,
                amount: amountOfMovies,
                friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0
            },
            user: req.user
        });
    });

    server.get('/:id/saved/:type', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

        let amountOfMovies;


        if(req.params.type == "movies"){
            amountOfMovies = await userService.getSavedMovies(res.locals.user._id)
            amountOfMovies = amountOfMovies.movies_saved.length
        }
        
                // header stats for profile cards
        let moviesTimeHeader = await userService.getTimeWatched(res.locals.user._id, "movies");
        let showsTimeHeader = await userService.getTimeWatched(res.locals.user._id, "shows");
        let numberOfMoviesHeader = 0; try { const wm = await userService.getWatchedMovies(res.locals.user._id); numberOfMoviesHeader = (wm && Array.isArray(wm.movies_watched)) ? wm.movies_watched.length : 0; } catch(_){}
        let numberOfShowsHeader = 0; try { const UserWatchedShows = require('../../../db/models/userWatchedShows'); const sw = await UserWatchedShows.findOne({ user_id: res.locals.user._id }).lean(); numberOfShowsHeader = (sw && Array.isArray(sw.shows_watched)) ? sw.shows_watched.length : 0; } catch(_){}let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "saved",
            page_data: {
                user: res.locals.user,
                amountOfMovies: amountOfMovies,
                friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0
            },
            user: req.user
        });
    });

    server.get('/:id/settings', getUser, isCorrectUser, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

                // header stats for profile cards
        let moviesTimeHeader = await userService.getTimeWatched(res.locals.user._id, "movies");
        let showsTimeHeader = await userService.getTimeWatched(res.locals.user._id, "shows");
        let numberOfMoviesHeader = 0; try { const wm = await userService.getWatchedMovies(res.locals.user._id); numberOfMoviesHeader = (wm && Array.isArray(wm.movies_watched)) ? wm.movies_watched.length : 0; } catch(_){}
        let numberOfShowsHeader = 0; try { const UserWatchedShows = require('../../../db/models/userWatchedShows'); const sw = await UserWatchedShows.findOne({ user_id: res.locals.user._id }).lean(); numberOfShowsHeader = (sw && Array.isArray(sw.shows_watched)) ? sw.shows_watched.length : 0; } catch(_){}let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
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
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "settings",
            page_data: {
                user: res.locals.user,
                friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0,
                badges: badgesDetailed
            },
            user: req.user
        });
    });

    // Stats page (design/dummy data for now)
    server.get('/:id/stats', getUser, enforceProfileVisibility, async (req, res, next) => {
        if (res.locals.user == null) return next('route');
                // Gather live counters for profile_stats cards
        let moviesTime = 0; let showsTime = 0; let numberOfMovies = 0; let numberOfShows = 0; let episodesCount = 0;
        try {
            moviesTime = await userService.getTimeWatched(res.locals.user._id, "movies");
            const wm = await userService.getWatchedMovies(res.locals.user._id);
            numberOfMovies = (wm && Array.isArray(wm.movies_watched)) ? wm.movies_watched.length : 0;
        } catch (_) {}
        try {
            const UserWatchedShows = require('../../../db/models/userWatchedShows');
            const sw = await UserWatchedShows.findOne({ user_id: res.locals.user._id }).lean();
            numberOfShows = (sw && Array.isArray(sw.shows_watched)) ? sw.shows_watched.length : 0;
        } catch (_) {}
        try { showsTime = await userService.getTimeWatched(res.locals.user._id, "shows"); } catch(_) { showsTime = '-'; }const dummy = {
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

        res.render('public assets/template.ejs', {
            page_title: 'iWatched.xyz - Stats',
            page_file: 'profile',
            page_subFile: 'stats_page',
            page_data: {
                user: res.locals.user,
                stats: dummy,
                movie_watch_time: moviesTime || '-',
                numberOfMoviesWatched: numberOfMovies,
                numberOfShowsWatched: numberOfShows,
                show_watch_time: showsTime || '-',
                numberOfEpisodesWatched: episodesCount
            },
            user: req.user
        });
    });

    // Badges page
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




