const tmdMovies = require('../../services/movies');
const tmdShows = require('../../services/shows');

module.exports = function (server) {
    console.log('* Index Routes Loaded Into Server');
    
    // New Home: use the new design from temp_home and hydrate with TMDb popular
    server.get('/', async function(req, res) {
        let popularMovies = [];
        let popularShows = [];
        try {
            popularMovies = await tmdMovies.getPopularMovies();
            // Extra safety: apply client-side rules here as well
            popularMovies = (popularMovies||[]).filter(m => (m && m.release_date) && Number(m.vote_count||0) > 0);
        } catch (e) { try { console.error('[Home] popularMovies failed:', e && e.message || e); } catch(_){} }
        try {
            popularShows = await tmdShows.getPopularShows();
            popularShows = (popularShows||[]).filter(s => {
                const ids = Array.isArray(s && s.genre_ids) ? s.genre_ids : [];
                const notReality = !ids.includes(10764);
                const notTalk = !ids.includes(10767);
                const notNews = !ids.includes(10763);
                const notDoc = !ids.includes(99);
                const hasDate = !!(s && s.first_air_date);
                const hasVotes = Number(s && s.vote_count || 0) > 0;
                return notReality && notTalk && notNews && notDoc && hasDate && hasVotes;
            });
        } catch (e) { try { console.error('[Home] popularShows failed:', e && e.message || e); } catch(_){} }
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Home",
            page_file: "temp_home",
            page_data: { popular: { movies: popularMovies, shows: popularShows } },
            user: req.user
        });
    });

    // /home and /index should point to root
    server.get('/home', (req, res) => res.redirect(302, '/'));
    server.get('/index', (req, res) => res.redirect(302, '/'));

    // Prototype dashboard-style home on /temp-home (uses logged-in layout wireframe)
    server.get('/temp-home', async function(req, res) {
        try {
            const user = req.user || null;
            const pageData = {};

            if (user) {
                const mongoose = require('mongoose');
                const UserMovie = require('../../../db/models/userMovie');
                const UserShow = require('../../../db/models/userShow');
                const UserFriends = require('../../../db/models/userFriends');
                const Review = require('../../../db/models/review');
                const Announcement = require('../../../db/models/announcement');
                const Movie = require('../../../db/models/movie');
                const Show = require('../../../db/models/show');

                const userId = user._id;

                // What to watch tonight: bookmarked movies/shows for current user
                const [bookmarkedMovies, bookmarkedShows] = await Promise.all([
                    UserMovie.find({ user_id: userId, movie_bookmarked: { $ne: null } })
                        .sort({ movie_bookmarked: -1, date_updated: -1 })
                        .limit(50)
                        .lean(),
                    UserShow.find({ user_id: userId, show_bookmarked: { $ne: null } })
                        .sort({ show_bookmarked: -1, date_updated: -1 })
                        .limit(50)
                        .lean()
                ]);

                const bookmarkItems = [];
                bookmarkedMovies.forEach(m => {
                    bookmarkItems.push({
                        type: 'movie',
                        tmdb_id: m.movie_id,
                        bookmarked_at: m.movie_bookmarked,
                        favourited_at: m.movie_favorite,
                        watched_at: m.movie_watched
                    });
                });
                bookmarkedShows.forEach(s => {
                    bookmarkItems.push({
                        type: 'show',
                        tmdb_id: s.show_id,
                        bookmarked_at: s.show_bookmarked,
                        favourited_at: s.show_favorite,
                        watched_at: s.show_watched
                    });
                });

                // Friends list
                let friendIds = [];
                try {
                    const doc = await UserFriends.findOne({ user_id: String(userId) }).lean();
                    friendIds = Array.isArray(doc && doc.friends) ? doc.friends.map(f => f.user_id).filter(Boolean) : [];
                } catch (_) { friendIds = []; }

                let friendsActivity = [];
                let friendsReviews = [];

                if (friendIds.length) {
                    // Friends bookmarked / watched / favourite history (movies + shows)
                    const friendObjectIds = friendIds
                        .map(id => {
                            try { return new mongoose.Types.ObjectId(id); } catch (_) { return null; }
                        })
                        .filter(Boolean);

                    const [friendMovies, friendShows, friendReviewsDocs] = await Promise.all([
                        UserMovie.find({
                            user_id: { $in: friendObjectIds },
                            $or: [
                                { movie_bookmarked: { $ne: null } },
                                { movie_favorite: { $ne: null } },
                                { movie_watched: { $ne: null } }
                            ]
                        }).sort({ date_updated: -1 }).limit(50).lean(),
                        UserShow.find({
                            user_id: { $in: friendObjectIds },
                            $or: [
                                { show_bookmarked: { $ne: null } },
                                { show_favorite: { $ne: null } },
                                { show_watched: { $ne: null } }
                            ]
                        }).sort({ date_updated: -1 }).limit(50).lean(),
                        Review.find({
                            author_id: { $in: friendObjectIds },
                            deleted: { $ne: true }
                        }).sort({ created_at: -1 }).limit(50).lean()
                    ]);

                    friendsActivity = []
                        .concat((friendMovies || []).map(m => ({
                            kind: 'movie',
                            tmdb_id: m.movie_id,
                            user_id: String(m.user_id),
                            bookmarked_at: m.movie_bookmarked,
                            favourited_at: m.movie_favorite,
                            watched_at: m.movie_watched,
                            date: m.date_updated
                        })))
                        .concat((friendShows || []).map(s => ({
                            kind: 'show',
                            tmdb_id: s.show_id,
                            user_id: String(s.user_id),
                            bookmarked_at: s.show_bookmarked,
                            favourited_at: s.show_favorite,
                            watched_at: s.show_watched,
                            date: s.date_updated
                        })))
                        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                        .slice(0, 50);

                    friendsReviews = friendReviewsDocs || [];
                }

                // Enrich bookmarks & friend activity with local Movie/Show docs where possible
                const allTmdbIds = [];
                bookmarkItems.forEach(it => { if (it.tmdb_id) allTmdbIds.push(it.tmdb_id); });
                friendsActivity.forEach(it => { if (it.tmdb_id) allTmdbIds.push(it.tmdb_id); });
                const uniqueIds = Array.from(new Set(allTmdbIds.map(String)));

                let moviesDocs = [];
                let showsDocs = [];
                if (uniqueIds.length) {
                    moviesDocs = await Movie.find({ tmd_id: { $in: uniqueIds } }).lean().catch(() => []);
                    showsDocs = await Show.find({ tmd_id: { $in: uniqueIds } }).lean().catch(() => []);
                }
                const movieMap = new Map((moviesDocs || []).map(m => [String(m.tmd_id), m]));
                const showMap = new Map((showsDocs || []).map(s => [String(s.tmd_id), s]));

                function formatRuntime(mins){
                    var m = Number(mins||0);
                    if (!m || m <= 0) return '';
                    var h = Math.floor(m / 60);
                    var rem = m % 60;
                    if (h && rem) return h+'h '+rem+'m';
                    if (h) return h+'h';
                    return rem+'m';
                }

                function mapTitle(it) {
                    if (!it || !it.tmdb_id) return null;
                    if (it.type === 'movie' || it.kind === 'movie') {
                        const m = movieMap.get(String(it.tmdb_id));
                        if (!m) return null;
                        return {
                            id: String(it.tmdb_id),
                            type: 'movie',
                            title: m.movie_title || m.title || '',
                            poster: m.poster_path || null,
                            runtime_text: formatRuntime(m.movie_runtime)
                        };
                    }
                    const s = showMap.get(String(it.tmdb_id));
                    if (!s) return null;
                    return {
                        id: String(it.tmdb_id),
                        type: 'show',
                        title: s.show_title || s.name || '',
                        poster: s.poster_path || null,
                        runtime_text: ''
                    };
                }

                pageData.tonight = (bookmarkItems || [])
                    .map(it => {
                        const meta = mapTitle(it);
                        if (!meta) return null;
                        return Object.assign({}, meta, {
                            bookmarked_at: it.bookmarked_at,
                            favourited_at: it.favourited_at,
                            watched_at: it.watched_at
                        });
                    })
                    .filter(Boolean)
                    .slice(0, 20);

                // Map friend ids to usernames
                let friendsLookup = {};
                if (friendIds.length) {
                    const User = require('../../../db/models/user');
                    const docs = await User.find({ _id: { $in: friendIds } })
                        .select('_id local.username profile.custom_url')
                        .lean()
                        .catch(() => []);
                    docs.forEach(u => {
                        friendsLookup[String(u._id)] = {
                            id: String(u._id),
                            username: (u.local && u.local.username) || '',
                            slug: (u.profile && u.profile.custom_url) || null
                        };
                    });
                }

                pageData.friends_activity = (friendsActivity || [])
                    .map(ev => {
                        const meta = mapTitle(ev);
                        if (!meta) return null;
                        const friend = friendsLookup[ev.user_id] || { username: 'Friend' };
                        let eventType = 'bookmarked';
                        if (ev.watched_at) eventType = 'watched';
                        else if (ev.favourited_at) eventType = 'favourited';
                        return Object.assign({}, meta, {
                            friend,
                            eventType,
                            date: ev.date
                        });
                    })
                    .filter(Boolean)
                    .slice(0, 20);

                // Latest reviews from friends (for feed)
                pageData.friends_reviews = (friendsReviews || []).slice(0, 50);

                // Latest announcements
                try {
                    const announcements = await Announcement.find({})
                        .sort({ created_at: -1 })
                        .limit(5)
                        .lean();
                    pageData.announcements = announcements || [];
                } catch (_) {
                    pageData.announcements = [];
                }
            }

            res.render('public assets/template.ejs', {
                page_title: "iWatched - Home (Prototype)",
                page_file: "temp_home_dashboard",
                page_data: pageData,
                user: req.user
            });
        } catch (e) {
            res.render('public assets/template.ejs', {
                page_title: "iWatched - Home (Prototype)",
                page_file: "temp_home_dashboard",
                page_data: {},
                user: req.user
            });
        }
    });

    server.get('/temp-user', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Temp User",
            page_file: "temp_user",
            user: req.user
        });
    });

    // (Removed: /ap shortcut was unnecessary)
}
