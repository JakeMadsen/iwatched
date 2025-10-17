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
        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();

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

        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
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


        if(req.params.type == "movies"){
            watchedTime = await userService.getTimeWatched(res.locals.user._id, "movies")
            amountOfMovies = await userService.getWatchedMovies(res.locals.user._id)
            amountOfMovies = amountOfMovies.movies_watched.length
        }

        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "watched",
            page_data: {
                user: res.locals.user,
                watchedTime: watchedTime,
                amountOfMovies: amountOfMovies,
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

        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
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
        
        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
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

        let friendsDoc = await UserFriends.findOne({ user_id: res.locals.user._id }).lean();
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "settings",
            page_data: {
                user: res.locals.user,
                friends_count: friendsDoc ? (friendsDoc.friends || []).length : 0
            },
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
