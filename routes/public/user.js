var passport = require('passport')
var mongoose = require('../../config/db/mongdb').connect();
var User = require('../../models/user');
// var tmd = require('../../config/tmd_scripts/search_tmd');
var fetch = require('node-fetch');  
var tmdKeys = require('../../config/tmd_scripts/oop_tmd');

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

    server.get('/login/forgot', 
        function (req, res) {
            
        }
    );

    // =========================================================================
    // USER PROFILE ============================================================
    // =========================================================================
    console.log('* User Profile Routes Loaded Into Server');

    server.get('/profile', isLoggedIn, 
        function(req, res) {
            res.render('public assets/pages/profile', {
                title: "Profile Page",
                page: "main",
                user : req.user // get the user out of session and pass to template
            });
        }
    );

    server.get('/profile', isLoggedIn, 
        function(req, res) {
            res.render('public assets/pages/profile', {
                title: "Profile Page",
                page: "main",
                user : req.user // get the user out of session and pass to template
            });
        }
    );

    server.get('/profile/:option', isLoggedIn,
        async function(req, res){

            res.render('public assets/pages/profile', {
                title: "Profile Page",
                page: req.params.option,
                user : req.user // get the user out of session and pass to template
            });
        }
    );


    // =========================================================================
    // USER PROFILE SETTINGS ===================================================
    // =========================================================================

    server.get('/profile/settings', isLoggedIn, 
        function(req, res) {
            res.render('public assets/pages/profile', {
                title: "Profile Settings Page",
                page: "settings",
                user : req.user // get the user out of session and pass to template
            });
        }
    );

    server.post('/profile/settings',
        function(req, res) {
            let user_id = req.user._id;
            console.log(`User (${user_id}) updated his profile`)

            User.findById(user_id, function(err, user){
                if (err) return handleError(err);
                
                user.updateUser(req.body.username, req.body.email, req.body.phone, req.body.password);

                user.save(function (err, userUpdated) {
                    if (err) return handleError(err);
                    res.redirect('/profile');
                });
            })
        }
    );

    server.post('/profile/delete',
        function(req, res) {
            let user_id = req.user._id;
            console.log(`User (${user_id}) deleted his profile`)

            User.findById(user_id, function(err, user){
                user.remove(function (err, userUpdated) {
                    if (err) return handleError(err);
                    res.redirect('/');
                });
            })
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
    // USER WATCHED ============================================================
    // =========================================================================

    server.post('/profile/watched/add',
        function(req, res) {
            let user_id = req.user._id;

            User.findById(user_id, function(err, user){
                if (err) return handleError(err);
                
                user.addWatched(req.body.add_watched_id, req.body.add_watched_type);

                user.save(function (err, userUpdated) {

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

function profileOptionCheck(option, movies, shows){
    var results = null;

    return new Promise(function(resolve, reject){
        switch(option){
            case "movies":
                // results = await getWatchedItems(option, movies, shows)
    
                
            break
        }
    });    
}

async function getWatchedItems(){
    // fetch()
}

