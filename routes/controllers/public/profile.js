const userService = require('../../services/users')
const getUser = require('../../middleware/getUser')
const createError = require('http-errors');


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
        }
    );

    server.post('/:id/delete', getUser, isCorrectUser, async (req, res) => {
        let user_id = req.user._id;
        console.log(`User (${user_id}) deleted his profile`)

        User.findById(user_id, function (err, user) {
            user.remove(function (err, userUpdated) {
                if (err) return handleError(err);
                res.redirect('/');
            });
        })
    }
    );
}

async function isCorrectUser(req, res, next) {
    if (req.user == 'undefined')
        throw new Error(createError(401, `You need to login to view your settings`))

    if (res.locals.user == null)
        throw new Error(createError(401, `You need to login to view your settings`))

    if (res.locals.user.permissions.myKey != req.user.permissions.myKey)
        throw new Error(createError(401, `You cant acess ${user.local.username}'s settings`))

    next()
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