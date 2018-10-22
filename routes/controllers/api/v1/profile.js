const User = require('../../../../db/models/user');
const Movie = require('../../../../db/models/movie');
const userService = require('../../../services/users');
const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb('ab4e974d12c288535f869686bd72e1da')

module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');

    server.post('/api/v1/profile/movies/add/', isCorrectUser, async (req, res) => {
        let user = await userService.getOne(req.body.user_id);

        let movieInfo = await tmdService.movieInfo(req.body.movie_id)

        Movie
            .findOne({ 'tmd_id': movieInfo.id })
            .exec((error, found) => {
                if (error)
                    res.send({ status: 400, message: "Something went wrong when adding movie" })
                console.log("found: ", found)
                if (!found) {
                    let newEntry = new Movie()
                    newEntry.initial(movieInfo)

                    newEntry.save()

                    console.log("new : ", newEntry)
                }

                user.addMovieWatched(req.body.movie_id)
                user.addMovieRuntime(req.body.movie_runtime)

                user.save((error, userUpdated) => {
                    if (error)
                        res.send({ status: 400, message: "Something went wrong when adding movie" })
                    if (userUpdated)
                        res.send({ status: 200, message: "Movie added" })
                })

            })

    });

    server.get('/api/v1/profile/movies/watched/:profile_id/:page?', async (req, res) => {
        var perPage = 10,
            page = Math.max(0, req.params.page || 1);

        User
            .findById(req.params.profile_id)
            .exec((error, user) => {
                let movies = user.movies.watched;

                if (error)
                    res.sendStatus(400)
                if (!user)
                    res.sendStatus(400)

                let movieList = []
                const start = async () => {
                    await asyncForEach(movies, async (movie) => {
                        let getMovie = await Movie.find({ 'tmd_id': movie.movie_id })

                        movieList.push(getMovie[0])
                    })
                    movieList.sort(function (a, b) {
                        var textA = a.title.toUpperCase();
                        var textB = b.title.toUpperCase();

                        return textA.localeCompare(textB);
                    });
                    let totalResults = movieList.length;
                    movieList = await paginateArray(movieList, perPage, page)

                    res.send({
                        page: page,
                        per_page: perPage,
                        user_id: user._id,
                        username: user.local.username,
                        total_results: totalResults,
                        amount_of_results: movieList.length,
                        results: movieList
                    })

                }
                start()
            })
    });
}
function paginateArray(array, page_size, page_number) {
    --page_number; // because pages logically start with 1, but technically with 0
    array = array.slice(page_number * page_size, (page_number + 1) * page_size);
    console.log(array.length)
    return array
}

async function isCorrectUser(req, res, next) {
    let key = req.body.user_key;
    let user = await userService.getOne(req.body.user_id)

    if (user.permissions.myKey != key)
        res.send({ status: 401, message: "You used the wrong api key" })

    next()
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array)
    }
}