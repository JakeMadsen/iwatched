const userService = require('../../services/users');
const getUser = require('../../middleware/getUser');
const createError = require('http-errors');
const isCorrectUser = require('../../middleware/isCorrectUser');


module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');

    server.get('/:id', getUser, async (req, res, next) => {

        if (res.locals.user == null)
            return next('route')

        let totalMoviesWatched = await userService.getTimeWatched(res.locals.user._id, "movies")
        let numberOfMoviesWatched = await userService.getWatchedMovies(res.locals.user._id)

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "main",
            page_data: {
                user: res.locals.user,
                movie_watch_time: totalMoviesWatched,
                numberOfMoviesWatched: numberOfMoviesWatched.movies_watched.length
            },
            user: req.user
        });
    });

    server.get('/:id/watched/:type', getUser, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

        let watchedTime;
        let amountOfMovies;


        if(req.params.type == "movies"){
            watchedTime = await userService.getTimeWatched(res.locals.user._id, "movies")
            amountOfMovies = await userService.getWatchedMovies(res.locals.user._id)
            amountOfMovies = amountOfMovies.movies_watched.length
        }

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "watched",
            page_data: {
                user: res.locals.user,
                watchedTime: watchedTime,
                amountOfMovies: amountOfMovies
            },
            user: req.user
        });
    });

    server.get('/:id/favourite/:type', getUser, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')
        let amountOfMovies;

        if(req.params.type == "movies"){
            amountOfMovies = await userService.getFavouritedMovies(res.locals.user._id)
            amountOfMovies = amountOfMovies.movies_favourited.length
        }

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "favourited",
            page_data: {
                user: res.locals.user,
                amount: amountOfMovies
            },
            user: req.user
        });
    });

    server.get('/:id/saved/:type', getUser, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

        let amountOfMovies;


        if(req.params.type == "movies"){
            amountOfMovies = await userService.getSavedMovies(res.locals.user._id)
            amountOfMovies = amountOfMovies.movies_saved.length
        }
        
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "saved",
            page_data: {
                user: res.locals.user,
                amountOfMovies: amountOfMovies
            },
            user: req.user
        });
    });

    server.get('/:id/settings', getUser, isCorrectUser, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "settings",
            page_data: {
                user: res.locals.user
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


