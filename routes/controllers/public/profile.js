const userService = require('../../services/users')
const getUser = require('../../middleware/getUser')

module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');

    server.get('/:id', getUser, async (req, res, next) => {
        if (res.locals.user == null)
            return next('route')

        let totalWatched = getTimeWatched(res.locals.user.profile.total_watch_time)
        let totalMovieWatched = getTimeWatched(res.locals.user.profile.movie_watch_time)

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "main",
            page_data: {
                user: res.locals.user,
                total_watch_time: totalWatched,
                movie_watch_time: totalMovieWatched
            },
            user: req.user
        });
    });
}

function getTimeWatched(runtime) {
    var days = Math.floor(runtime / 1440);
    var hours = Math.floor((runtime - (days * 1440)) / 60);
    var minutes = Math.round(runtime % 60);
    var text = "hour"
    var text2 = "day"

    if (hours > 1 || hours == 0)
        text = "hours"
    if (days > 1 || days == 0)
        text2 = "days"

    return (`${days} ${text2} and ${hours} ${text} and ${minutes} minutes`);
}