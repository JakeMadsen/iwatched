const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb('ab4e974d12c288535f869686bd72e1da')

module.exports = function (server) {
    console.log('* Movie Routes Loaded Into Server');

    server.get('/api/v1/movies/search/:search_param?/:page?', async (req, res) => {
        const parameters = {
            query: req.params.search_param || "",
            page: req.params.page || 1,
            include_adult: false
        }

        tmdService
            .searchMovie(parameters)
            .then(results => {
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
            .then(results => {
                res.send(results)

            })
            .catch(error => {
                res.send(error)
            })
    });
}