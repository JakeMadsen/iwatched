/*
*   Mongoose models
**************************/
const User                  = require('../../../../db/models/user');
const UserWatchedMovies     = require('../../../../db/models/userWatchedMovies');
const UserFavouritedMovies  = require('../../../../db/models/userFavouritedMovies');
const UserSavedMovies       = require('../../../../db/models/userSavedMovies');
const Movie                 = require('../../../../db/models/movie');

/*
*   Services
**************************/
const userService           = require('../../../services/users');
const movieService          = require('../../../services/movies')
const apiIsCorrectUser      = require('../../../middleware/apiIsCorrectUser');
const MovieDb               = require('moviedb-promise');
const tmdService            = new MovieDb('ab4e974d12c288535f869686bd72e1da');
const paginateArray         = require('../../../services/paginateArray');
const createError           = require("http-errors");


module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');
    
    /*  Watched routes
    *   Add and remove movies watched
    **************************************/

    server.post('/api/v1/profile/movies/watched/add/', apiIsCorrectUser, async (req, res) => {
        try {
            let movieInfo = await tmdService.movieInfo(req.body.movie_id)

            Movie
            .findOne({ 'tmd_id': movieInfo.id })
            .exec((error, found) => {
                if (error) return res.status(400).send({ status: 400, message: "Something went wrong when adding movie to movie db" })
                if (!found) {
                    let newEntry = new Movie()
                    newEntry.initial(movieInfo)
                    newEntry.save()
                }

                UserWatchedMovies.findOne({ 'user_id': req.body.user_id }, (error, watchedMovies) => {
                    if (error) return res.status(400).send({ status: 400, message: "Something went wrong when adding movie to user watched" });
                    if (!watchedMovies) return res.status(404).send({ status: 404, message: "Watched list not found" });

                    watchedMovies.addMovieWatched(req.body.movie_id)
                    watchedMovies.addMovieRuntime(movieInfo.runtime)
                    watchedMovies.save()
                    if (!res.headersSent) return res.status(200).send({ status: 'ok' })
                })
            })
        } catch (e) {
            if (!res.headersSent) return res.status(500).send({ status: 500, message: 'Internal error' })
        }
    });

    server.post('/api/v1/profile/movies/watched/remove/', apiIsCorrectUser, async (req, res) => {
        try {
            let runtime = await movieService.getMoveRuntimeIfNull(req.body.movie_id)
            UserWatchedMovies.findOne({ 'user_id': req.body.user_id }, (error, watchedMovies) => {
                if(error) return res.status(400).send({ status: 400 })
                if(!watchedMovies) return res.status(404).send({ status: 404, message: 'Watched list not found' })

                watchedMovies.removeMovieWatched(req.body.movie_id)
                watchedMovies.removeMovieRuntime(runtime)
                watchedMovies.save()
                if (!res.headersSent) return res.status(200).send({ status: 'ok' })
            })
        } catch (e) {
            if (!res.headersSent) return res.status(500).send({ status: 500, message: 'Internal error' })
        }
    });

    server.post('/api/v1/profile/movies/favourited/add/', apiIsCorrectUser, async (req, res) => {
        try {
            let movieInfo = await tmdService.movieInfo(req.body.movie_id)

            Movie
            .findOne({ 'tmd_id': movieInfo.id })
            .exec((error, found) => {
                if (error) return res.status(400).send({ status: 400, message: "Something went wrong when adding movie to movie db" });
                if (!found) {
                    let newEntry = new Movie();
                    newEntry.initial(movieInfo);
                    newEntry.save();
                }

                UserFavouritedMovies.findOne({ 'user_id': req.body.user_id }, (error, favouritedMovies) => {
                    if (error) return res.status(400).send({ status: 400, message: "Something went wrong when adding movie to user favourited" });
                    if (!favouritedMovies) return res.status(404).send({ status: 404, message: 'Favourited list not found' });

                    favouritedMovies.addFavouritedMovie(req.body.movie_id);
                    favouritedMovies.save();
                    if (!res.headersSent) return res.status(200).send({ status: 'ok' })
                })
            })
        } catch (e) {
            if (!res.headersSent) return res.status(500).send({ status: 500, message: 'Internal error' })
        }
    });

    server.post('/api/v1/profile/movies/favourited/remove/', apiIsCorrectUser, async (req, res) => {
        try {
            UserFavouritedMovies.findOne({ 'user_id': req.body.user_id }, (error, favouritedMovies) => {
                if(error) return res.status(400).send({ status: 400, error: "Couldnt remove favourited movie"});
                if(!favouritedMovies) return res.status(404).send({ status: 404, message: 'Favourited list not found' });

                favouritedMovies.removeFavouritedMovie(req.body.movie_id);
                favouritedMovies.save();
                if (!res.headersSent) return res.status(200).send({ status: 'ok' })
            })
        } catch (e) {
            if (!res.headersSent) return res.status(500).send({ status: 500, message: 'Internal error' })
        }
    });

    server.post('/api/v1/profile/movies/saved/add/', apiIsCorrectUser, async (req, res) => {
        try {
            let movieInfo = await tmdService.movieInfo(req.body.movie_id)

            Movie
            .findOne({ 'tmd_id': movieInfo.id })
            .exec((error, found) => {
                if (error) return res.status(400).send({ status: 400, message: "Something went wrong when adding movie to movie db" });
                if (!found) {
                    let newEntry = new Movie();
                    newEntry.initial(movieInfo);
                    newEntry.save();
                }

                UserSavedMovies.findOne({ 'user_id': req.body.user_id }, (error, savedMovies) => {
                    if (error) return res.status(400).send({ status: 400, message: "Something went wrong when adding movie to user favourited" });
                    if (!savedMovies) return res.status(404).send({ status: 404, message: 'Saved list not found' });

                    savedMovies.addSavedMovie(req.body.movie_id);
                    savedMovies.save();
                    if (!res.headersSent) return res.status(200).send({ status: 'ok' })
                })
            })
        } catch (e) {
            if (!res.headersSent) return res.status(500).send({ status: 500, message: 'Internal error' })
        }
    });

    server.post('/api/v1/profile/movies/saved/remove/', apiIsCorrectUser, async (req, res) => {
        try {
            UserSavedMovies.findOne({ 'user_id': req.body.user_id }, (error, savedMovies) => {
                if(error) return res.status(400).send({ status: 400 })
                if(!savedMovies) return res.status(404).send({ status: 404, message: 'Saved list not found' })

                savedMovies.removeSavedMovie(req.body.movie_id)
                savedMovies.save()
                if (!res.headersSent) return res.status(200).send({ status: 'ok' })
            })
        } catch (e) {
            if (!res.headersSent) return res.status(500).send({ status: 500, message: 'Internal error' })
        }
    });


    /*
    *   Get all watched/saved/favourited movies and latest added
    **************************************/

    server.get('/api/v1/profile/movies/watched/:profile_id/:page?', async (req, res) => {
        var perPage = 18,
        page = Math.max(0, req.params.page || 1);

        userService
        .getOne(req.params.profile_id)
        .then(user => {

            if(!user)
                res.send(createError(404, { error: "No user found" }));

            else
            userService
            .getWatchedMovies(user._id)
            .then(watched => {

                let movieList = watched.movies_watched.map((obj) => obj.id)
        
                Movie
                .find({'tmd_id': { $in: movieList }})
                .collation({locale:'en',strength: 2})
                .sort({movie_title:1})
                .exec((error, movies) => {

                    if (error)
                        res.sendStatus(404)

                    let totalResults = movies.length;
                        movies = paginateArray(movies, perPage, page)

                    res.send({
                        page: page,
                        per_page: perPage,
                        user_id: user._id,
                        username: user.local.username,
                        total_results: totalResults,
                        amount_of_results: movies.length,
                        results: movies
                    })

                })

            })
            .catch(error => {
                res.send(createError(400, error))
            })
        })
        .catch(error => {
            res.send(createError(400, error))
        })
    });

    server.get('/api/v1/profile/movies/favourited/:profile_id/:page?', async (req, res) => {
        var perPage = 18,
            page = Math.max(0, req.params.page || 1);

        userService
        .getOne(req.params.profile_id)
        .then(user => {

            if(!user)
                res.send(createError(404, { error: "No user found" }));

            else
            userService
            .getFavouritedMovies(user._id)
            .then(favourited => {

                let movieList = favourited.movies_favourited.map((obj) => obj.id)
        
                Movie
                .find({'tmd_id': { $in: movieList }})
                .collation({locale:'en',strength: 2})
                .sort({movie_title:1})
                .exec((error, movies) => {

                    if (error)
                        res.sendStatus(404)
    
                    let totalResults = movies.length;
                        movies = paginateArray(movies, perPage, page)
    
                    res.send({
                        page: page,
                        per_page: perPage,
                        user_id: user._id,
                        username: user.local.username,
                        total_results: totalResults,
                        amount_of_results: movies.length,
                        results: movies
                    })
    
                })

            })
            .catch(error => {
                res.send(createError(400, error))
            })
        })
        .catch(error => {
            res.send(createError(400, error))
        })
    });

    server.get('/api/v1/profile/movies/saved/:profile_id/:page?', async (req, res) => {
        var perPage = 18,
            page = Math.max(0, req.params.page || 1);

        userService
        .getOne(req.params.profile_id)
        .then(user => {

            if(!user)
                res.send(createError(404, { error: "No user found" }));

            else
            userService
            .getSavedMovies(user._id)
            .then(saved => {

                let movieList = saved.movies_saved.map((obj) => obj.id)
        
                Movie
                .find({'tmd_id': { $in: movieList }})
                .collation({locale:'en',strength: 2})
                .sort({movie_title:1})
                .exec((error, movies) => {

                    if (error)
                        res.sendStatus(404)
    
                    let totalResults = movies.length;
                        movies = paginateArray(movies, perPage, page)
    
                    res.send({
                        page: page,
                        per_page: perPage,
                        user_id: user._id,
                        username: user.local.username,
                        total_results: totalResults,
                        amount_of_results: movies.length,
                        results: movies
                    })
    
                })

            })
            .catch(error => {
                res.send(createError(400, error))
            })
        })
        .catch(error => {
            res.send(createError(400, error))
        })
    });

    server.get('/api/v1/profile/movies/latest/:profile_id', async (req, res) => {
        User
        .findById(req.params.profile_id)
        .exec(async (error, user) => {
            let movies = await userService.getWatchedMovies(user._id)
            let movieList = movies.movies_watched.map((obj) => obj.id)
                movieList = movieList.slice(Math.max(movieList.length - 12, 0))

            if (error)
                res.sendStatus(400)
            if (!user)
                res.sendStatus(400)

            Movie
            .find({'tmd_id': { $in: movieList }})
            .exec((error, movies) => {
                if (error)
                    res.sendStatus(400)

                let sorted = [];
                movieList.forEach((movie_id) => {
                    movies.forEach(movie => {
                        if(movie_id == movie.tmd_id)
                            sorted.push(movie)
                    })
                })
                res.send({
                    user_id: user._id,
                    username: user.local.username,
                    amount_of_results: movieList.length,
                    results: sorted.reverse()
                })
            })
        })
    });

    /*
    *   Check routes
    **************************************/

    server.get('/api/v1/profile/movies/check/watched/:profile_id/:movie_id', async (req, res) => {
        let watched = await userService.checkIfUserWatchedMovie(req.params.profile_id, req.params.movie_id);
        res.send(watched)
    })

    server.get('/api/v1/profile/movies/check/favourited/:profile_id/:movie_id', async (req, res) => {
        let watched = await userService.checkIfUserFavouritedMovie(req.params.profile_id, req.params.movie_id);
        res.send(watched)
    })

    server.get('/api/v1/profile/movies/check/saved/:profile_id/:movie_id', async (req, res) => {
        let watched = await userService.checkIfUserSavedMovie(req.params.profile_id, req.params.movie_id);
        res.send(watched)
    })
}
