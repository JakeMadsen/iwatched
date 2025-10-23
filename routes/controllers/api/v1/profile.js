/*
*   Mongoose models
**************************/
const User                  = require('../../../../db/models/user');
const UserWatchedMovies     = require('../../../../db/models/userWatchedMovies');
const UserFavouritedMovies  = require('../../../../db/models/userFavouritedMovies');
const UserSavedMovies       = require('../../../../db/models/userSavedMovies');
const Movie                 = require('../../../../db/models/movie');
const Show                  = require('../../../../db/models/show');
const UserWatchedShows      = require('../../../../db/models/userWatchedShows');
const UserFavouritedShows   = require('../../../../db/models/userFavouritedShows');
const UserSavedShows        = require('../../../../db/models/userSavedShows');

/*
*   Services
**************************/
const userService           = require('../../../services/users');
const movieService          = require('../../../services/movies')
const apiIsCorrectUser      = require('../../../middleware/apiIsCorrectUser');
const MovieDb               = require('moviedb-promise');
const tmdService            = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');
const paginateArray         = require('../../../services/paginateArray');
const createError           = require("http-errors");


module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');
    // Disable all legacy profile endpoints in favor of unified user-movies/user-shows
    server.all('/api/v1/profile/*', (req, res, next) => {
        return res.status(410).send({ status: 410, message: 'Deprecated. Use /api/v1/user-movies and /api/v1/user-shows.' });
    });
    
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

    // ===================== SHOWS: Watched / Favourited / Saved ===================== //

    server.post('/api/v1/profile/shows/watched/add/', apiIsCorrectUser, async (req, res) => {
        try {
            const showInfo = await tmdService.tvInfo(req.body.movie_id || req.body.show_id);
            Show.findOne({ 'tmd_id': showInfo.id }).exec((error, found) => {
                if (error) return res.status(400).send({ status: 400, message: 'Failed adding show to DB' });
                if (!found) { let s = new Show(); s.initial(showInfo); s.save(); }
                UserWatchedShows.findOne({ 'user_id': req.body.user_id }, (err, doc) => {
                    if (err) return res.status(400).send({ status: 400, message: 'Failed adding to watched' });
                    if (!doc) { let nw = new UserWatchedShows(); nw.initial(req.body.user_id); doc = nw; }
                    doc.addShowWatched(showInfo.id);
                    // Use episode runtime if provided
                    const minutes = (Array.isArray(showInfo.episode_run_time) && showInfo.episode_run_time[0]) || 0;
                    if (minutes) doc.addShowRuntime(minutes);
                    doc.save();
                    if (!res.headersSent) return res.status(200).send({ status: 'ok' });
                });
            });
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    server.post('/api/v1/profile/shows/watched/remove/', apiIsCorrectUser, async (req, res) => {
        try {
            const showInfo = await tmdService.tvInfo(req.body.movie_id || req.body.show_id).catch(()=>({}));
            const minutes = (Array.isArray(showInfo.episode_run_time) && showInfo.episode_run_time[0]) || 0;
            UserWatchedShows.findOne({ 'user_id': req.body.user_id }, (err, doc) => {
                if(err) return res.status(400).send({ status: 400 });
                if(!doc) return res.status(404).send({ status: 404, message: 'Watched list not found' });
                doc.removeShowWatched(req.body.movie_id || req.body.show_id);
                if (minutes) doc.removeShowRuntime(minutes);
                doc.save();
                if (!res.headersSent) return res.status(200).send({ status: 'ok' });
            })
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    server.post('/api/v1/profile/shows/favourited/add/', apiIsCorrectUser, async (req, res) => {
        try {
            const showInfo = await tmdService.tvInfo(req.body.movie_id || req.body.show_id);
            Show.findOne({ 'tmd_id': showInfo.id }).exec((error, found) => {
                if (error) return res.status(400).send({ status: 400 });
                if (!found) { let s = new Show(); s.initial(showInfo); s.save(); }
                UserFavouritedShows.findOne({ 'user_id': req.body.user_id }, (err, doc) => {
                    if (err) return res.status(400).send({ status: 400 });
                    if (!doc) { let nf = new UserFavouritedShows(); nf.initial(req.body.user_id); doc = nf; }
                    doc.addFavouritedShow(showInfo.id); doc.save();
                    if (!res.headersSent) return res.status(200).send({ status: 'ok' });
                })
            })
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    server.post('/api/v1/profile/shows/favourited/remove/', apiIsCorrectUser, async (req, res) => {
        try {
            UserFavouritedShows.findOne({ 'user_id': req.body.user_id }, (err, doc) => {
                if(err) return res.status(400).send({ status: 400 });
                if(!doc) return res.status(404).send({ status: 404 });
                doc.removeFavouritedShow(req.body.movie_id || req.body.show_id); doc.save();
                if (!res.headersSent) return res.status(200).send({ status: 'ok' });
            })
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    server.post('/api/v1/profile/shows/saved/add/', apiIsCorrectUser, async (req, res) => {
        try {
            const showInfo = await tmdService.tvInfo(req.body.movie_id || req.body.show_id);
            Show.findOne({ 'tmd_id': showInfo.id }).exec((error, found) => {
                if (error) return res.status(400).send({ status: 400 });
                if (!found) { let s = new Show(); s.initial(showInfo); s.save(); }
                UserSavedShows.findOne({ 'user_id': req.body.user_id }, (err, doc) => {
                    if (err) return res.status(400).send({ status: 400 });
                    if (!doc) { let ns = new UserSavedShows(); ns.initial(req.body.user_id); doc = ns; }
                    doc.addSavedShow(showInfo.id); doc.save();
                    if (!res.headersSent) return res.status(200).send({ status: 'ok' });
                })
            })
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    server.post('/api/v1/profile/shows/saved/remove/', apiIsCorrectUser, async (req, res) => {
        try {
            UserSavedShows.findOne({ 'user_id': req.body.user_id }, (err, doc) => {
                if(err) return res.status(400).send({ status: 400 });
                if(!doc) return res.status(404).send({ status: 404 });
                doc.removeSavedShow(req.body.movie_id || req.body.show_id); doc.save();
                if (!res.headersSent) return res.status(200).send({ status: 'ok' });
            })
        } catch (e) { if (!res.headersSent) return res.status(500).send({ status: 500 }); }
    });

    // Checks
    server.get('/api/v1/profile/shows/check/watched/:profile_id/:show_id', async (req, res) => {
        try {
            const doc = await UserWatchedShows.findOne({ user_id: req.params.profile_id }).lean();
            const exists = !!(doc && (doc.shows_watched||[]).some(m => String(m.id) === String(req.params.show_id)));
            res.send(exists);
        } catch (e) { res.send(false); }
    })
    server.get('/api/v1/profile/shows/check/favourited/:profile_id/:show_id', async (req, res) => {
        try {
            const doc = await UserFavouritedShows.findOne({ user_id: req.params.profile_id }).lean();
            const exists = !!(doc && (doc.shows_favourited||[]).some(m => String(m.id) === String(req.params.show_id)));
            res.send(exists);
        } catch (e) { res.send(false); }
    })
    server.get('/api/v1/profile/shows/check/saved/:profile_id/:show_id', async (req, res) => {
        try {
            const doc = await UserSavedShows.findOne({ user_id: req.params.profile_id }).lean();
            const exists = !!(doc && (doc.shows_saved||[]).some(m => String(m.id) === String(req.params.show_id)));
            res.send(exists);
        } catch (e) { res.send(false); }
    })

    // Listing watched shows (paginated)
    server.get('/api/v1/profile/shows/watched/:profile_id/:page?', async (req, res) => {
        var perPage = 18, page = Math.max(0, req.params.page || 1);
        const sort = String(req.query.sort || '').toLowerCase();
        try {
            const user = await userService.getOne(req.params.profile_id);
            if(!user) return res.send(createError(404, { error: 'No user found' }));
            const watched = await UserWatchedShows.findOne({ user_id: user._id }).lean();
            const list = watched ? (watched.shows_watched||[]).map(o=>o.id) : [];
            let items = await Show.find({ 'tmd_id': { $in: list } }).collation({locale:'en',strength:2}).sort({ show_title:1 }).lean();

            // Optional enrichment for sorting by seasons or first air date
            if (sort) {
                const details = await Promise.all(items.map(s => tmdService.tvInfo(s.tmd_id).catch(()=>null)));
                const byId = new Map();
                items.forEach((s, idx) => {
                    const d = details[idx] || {};
                    const seasons = Array.isArray(d.seasons) ? d.seasons.filter(x => Number(x.season_number) !== 0).length : (d.number_of_seasons || 0);
                    byId.set(String(s.tmd_id), {
                        seasons: seasons || 0,
                        first_air_date: d.first_air_date || null,
                        first_air_year: d.first_air_date ? String(d.first_air_date).slice(0,4) : null
                    });
                });
                items = items.map(s => Object.assign({}, s, byId.get(String(s.tmd_id)) || {}));
                const cmp = (a,b,k,dir) => { const av = a[k] || 0; const bv = b[k] || 0; return dir==='desc' ? ((bv>av)-(bv<av)) : ((av>bv)-(av<bv)); };
                if (sort === 'seasons_desc') items.sort((a,b)=>cmp(a,b,'seasons','desc'));
                else if (sort === 'seasons_asc') items.sort((a,b)=>cmp(a,b,'seasons','asc'));
                else if (sort === 'first_air_desc') items.sort((a,b)=>cmp(a,b,'first_air_year','desc'));
                else if (sort === 'first_air_asc') items.sort((a,b)=>cmp(a,b,'first_air_year','asc'));
            }

            const total = items.length; const pageItems = paginateArray(items, perPage, page);
            res.send({ page, per_page: perPage, user_id: user._id, username: user.local.username, total_results: total, amount_of_results: pageItems.length, results: pageItems });
        } catch (e) { res.send(createError(400, e)); }
    });
}
