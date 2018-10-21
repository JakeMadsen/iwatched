const User = require('../../../../db/models/user');
const userService = require('../../../services/users');

module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');

    /// Query params
    server.get('/api/v1/profile/:profile_id/movies/add/:movie_id/:movie_runtime', isCorrectUser, async (req, res) => {
        let user = await userService.getOne(req.params.id);

        user.addMovieWatched(req.params.movie_id)
        user.addMovieRuntime(req.params.movie_runtime)

        user.save((error, userUpdated) => {
            if(error)
                res.send({ status: 400, message: "Something went wrong when adding movie" })
            if(userUpdated)
                res.send(userUpdated)
        })
    });
}

async function isCorrectUser (req, res, next) {
    let key = req.query.userKey;
    let user = await userService.getOne(req.params.id)

    if(user.permissions.myKey != key)
        res.send({ status: 401, message: "You used the wrong api key" })

    else
        next()
}