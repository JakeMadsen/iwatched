var LocalStrategy = require('passport-local').Strategy;
var User = require('../../db/models/user');
var UserWatchedMovies = require('../../db/models/userWatchedMovies');
var UserFavouritedMovies = require('../../db/models/userFavouritedMovies');
var UserSavedMovies = require('../../db/models/userSavedMovies');


module.exports = (passport) => {

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) => {
            done(err, user);
        });
    });

    passport.use('local-signup', new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true,

    },
    function (req, username, password, done) {
        process.nextTick(function () {
            User
            .findOne(
                { $or: [
                    { 'local.email': req.body.email },
                    { 'local.username': username }
                ]}, function (err, user) {
                if (err)
                    return done(err);

                if (user) {
                    let text = null;
                    if(user.local.username == username)
                        text = 'Username'

                    if(user.local.email == req.body.email){
                        if(text != null)
                            text = 'Username and Email'
                        else
                            text = 'Email'
                    }
                    return done(null, false, req.flash('signupMessage', `That ${text} is already taken.`));
                } else {

                    var newUser = new User();
                        newUser.initialSignup(username, req.body.email, password)
                        // Temporary: mark all newly created users as beta testers
                        try { newUser.profile = newUser.profile || {}; newUser.profile.flags = newUser.profile.flags || {}; newUser.profile.flags.beta_tester = true; } catch (e) {}

                    newUser.save((err) => {

                        let newWatched = new UserWatchedMovies()
                            newWatched.initial(newUser._id)
                            newWatched.save();

                        let newFavourited = new UserFavouritedMovies()
                            newFavourited.initial(newUser._id)
                            newFavourited.save();

                        let newSaved = new UserSavedMovies()
                            newSaved.initial(newUser._id)
                            newSaved.save();

                        try {
                            const UserWatchedShows = require('../../db/models/userWatchedShows');
                            const UserFavouritedShows = require('../../db/models/userFavouritedShows');
                            const UserSavedShows = require('../../db/models/userSavedShows');
                            let ws = new UserWatchedShows(); ws.initial(newUser._id); ws.save();
                            let fs = new UserFavouritedShows(); fs.initial(newUser._id); fs.save();
                            let ss = new UserSavedShows(); ss.initial(newUser._id); ss.save();
                        } catch (_) {}

                        if (err)
                            throw err;
                        return done(null, newUser);
                    });
                }
            })
        });
    }));

    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    passport.use('local-login', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true 
    },
        function (req, login, password, done) { 
            const escaped = escapeRegex(login || '');
            User.findOne({$or: [
                {'local.email': new RegExp('^' + escaped + '$', 'i') },
                {'local.username': new RegExp('^' + escaped + '$', 'i')}
            ]}, function (error, user) {

                if (error)
                    return done(null, false, req.flash('flash', {'error': error, 'login' : login})); 

                if (!user)
                    return done(null, false, req.flash('flash', {'error': 'No user found', 'login' : login})); 

                if (!user.validPassword(password))
                    return done(null, false, req.flash('flash', {'error': 'Wrong password', 'login' : login}));

                return done(null, user);
            });
        })
    );
};
