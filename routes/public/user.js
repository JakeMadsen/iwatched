var passport = require('passport')

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
    // USER ADD WATCHED ========================================================
    // =========================================================================

    server.post('/add',
        function (req, res) {
            console.log("Add Watched")
            let id = req.body.add_watched_id
            let type = req.body.add_watched_type
            let user_id = req.user._id;

            console.log("Watched ID: " + id);
            console.log("Watched Type: " + type);
            console.log("Current User: " + user_id)

            
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
