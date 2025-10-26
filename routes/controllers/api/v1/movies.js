const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da')

module.exports = function (server) {
    console.log('* Movie Routes Loaded Into Server');

    const UserMovie = require('../../../../db/models/userMovie');

    server.get('/api/v1/movies/search/:search_param?/:page?', async (req, res) => {
        const parameters = {
            query: req.params.search_param || "",
            page: req.params.page || 1,
            include_adult: false
        }

        tmdService
            .searchMovie(parameters)
            .then(async results => {
                try {
                    if (String(req.query.hide_watched||'') === '1' && req.query.profile_id) {
                        const watchedDocs = await UserMovie.find({ user_id: String(req.query.profile_id), $or: [ { movie_watched_count: { $gt: 0 } }, { movie_watched: { $ne: null } } ] }).select('movie_id').lean();
                        const watchedSet = new Set((watchedDocs||[]).map(d => String(d.movie_id)));
                        const filtered = Object.assign({}, results, { results: (results.results||[]).filter(r => !watchedSet.has(String(r.id))) });
                        return res.send(filtered);
                    }
                } catch(_){}
                res.send(results)
            })
            .catch(error => {
                res.send(error)
            })
    });

    server.get('/api/v1/movies/search_genre/:genre/:page?', async (req, res) => {
        let genres = await tmdService.genreMovieList();
        let genre_id
        genres.genres.forEach(genre => {
            if (req.params.genre.toString() == genre.name.toLowerCase())
                genre_id = genre.id
        });

        const parameters = {
            id: genre_id,
            page: req.params.page || 1,
            include_adult: false
        }

        tmdService
            .genreMovies(parameters)
            .then(async results => {
                try {
                    if (String(req.query.hide_watched||'') === '1' && req.query.profile_id) {
                        const watchedDocs = await UserMovie.find({ user_id: String(req.query.profile_id), $or: [ { movie_watched_count: { $gt: 0 } }, { movie_watched: { $ne: null } } ] }).select('movie_id').lean();
                        const watchedSet = new Set((watchedDocs||[]).map(d => String(d.movie_id)));
                        const filtered = Object.assign({}, results, { results: (results.results||[]).filter(r => !watchedSet.has(String(r.id))) });
                        return res.send(filtered);
                    }
                } catch(_){}
                res.send(results)
            })
            .catch(error => {
                res.send(error)
            })
    });

    server.get('/api/v1/movies/get_poster/:id', async (req, res) => {
        let movie = await tmdService.movieInfo(req.params.id)
        let posterPath = {
            poster_path: movie.poster_path
        }
        if(movie == 'undefined' || null)
            res.send("error")
        else
            res.send(posterPath)


    });
}
