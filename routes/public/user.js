var passport = require('passport')
var mongoose = require('../../config/db/mongdb').connect();
var User = require('../../models/user');

mongoose.on('error', console.error.bind(console, 'connection error:'));
mongoose.once('open', function() {
//   console.log("connection successfull")
});

module.exports = function (server) {
    // =========================================================================
    // USER LOG IN/OUT =========================================================
    // =========================================================================
    console.log('* Login Routes Loaded Into Server');

    server.get('/login',
        function (req, res) {
            res.render('public assets/pages/login', {
                title: "Login",
                message_login: req.flash('loginMessage'),
                message_signup: req.flash('signupMessage'),
                user: req.user // get the user out of session and pass to template
            });
        }
    );

    server.post('/login',
        passport.authenticate('local-login', {
            successRedirect: '/profile', // redirect to the secure profile section
            failureRedirect: '/login', // redirect back to the signup page if there is an error
            failureFlash: true // allow flash messages
        })
    );

    server.post('/signup',
        passport.authenticate('local-signup', {
            successRedirect: '/profile', // redirect to the secure profile section
            failureRedirect: '/login', // redirect back to the signup page if there is an error
            failureFlash: true // allow flash messages
        })
    );

    server.get('/logout',
        function (req, res) {
            req.logout();
            res.redirect('/');
        }
    );

    // =========================================================================
    // USER PROFILE ============================================================
    // =========================================================================
    console.log('* User Profile Routes Loaded Into Server');

    server.get('/profile', isLoggedIn, 
        function(req, res) {
            res.render('public assets/pages/profile', {
                title: "Profile",
                user : req.user // get the user out of session and pass to template
            });
        }
    );

    // =========================================================================
    // USER NEWSLETTER =========================================================
    // =========================================================================

    server.post('/newsletter/subscribe',
        function(req, res) {
            let user_id = req.user._id;
            console.log(`User (${user_id}) subcribed to newsletter`)

            User.findById(user_id, function(err, user){
                if (err) return handleError(err);

                user.local.newsletter = true;

                user.save(function (err, userUpdated) {
                    if (err) return handleError(err);
                    res.redirect('/profile');
                });
            })
        }
    );

    server.post('/newsletter/unsubscribe',
        function(req, res) {
            let user_id = req.user._id;
            console.log(`User (${user_id}) unsubcribed from newsletter`)

            User.findById(user_id, function(err, user){
                if (err) return handleError(err);

                user.local.newsletter = false;

                user.save(function (err, userUpdated) {
                    if (err) return handleError(err);
                    res.redirect('/profile');
                });
            })
        }
    );
    
    // =========================================================================
    // USER ADD WATCHED ========================================================
    // =========================================================================

    server.post('/add',
        function(req, res) {
            console.log("Add Watched")
            let id = req.body.add_watched_id
            let type = req.body.add_watched_type
            let user_id = req.user._id;

            console.log("Watched ID: " + id);
            console.log("Watched Type: " + type);
            console.log("Current User: " + user_id)

            User.findById(user_id, function(err, user){
                if (err) return handleError(err);
                let check = false;
                if(type == "series"){
                    let series = user.local.watched_series;

                    for(i=0; i <= series.length; i++){
                        if(series[i] == id)
                            check = true
                    }
                    if(check == false)
                        user.local.watched_series.push(id)
                }
                else if(type == "movies"){
                    let movies = user.local.watched_movies;

                    for(i=0; i <= movies.length; i++){
                        if(movies[i] == id)
                            check = true
                    }
                    if(check == false)
                        user.local.watched_movies.push(id)
                }
                user.save(function (err, userUpdated) {
                    console.log(userUpdated)
                    if (err) return handleError(err);
                    res.redirect('/profile');
                });
            })
        }
    );
}

function isLoggedIn(req, res, next) {
    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}
