var LocalStrategy = require('passport-local').Strategy;
var User = require('../../db/models/user');

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
                ]}), 
            function (err, user) {
                console.log("user: " , user)
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

                    newUser.save((err) => {
                        if (err)
                            throw err;
                        return done(null, newUser);
                    });
                }
            }
        });
    }));

    passport.use('local-login', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true 
    },
        function (req, login, password, done) { 
            User.findOne({$or: [
                {'local.email': login},
                {'local.username': login}
            ]}, function (err, user) {
                if (err)
                    return done(err);

                if (!user)
                    return done(null, false, req.flash('loginMessage', 'No user found.')); 

                if (!user.validPassword(password))
                    return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.'));

                return done(null, user);
            });
        }));
};
