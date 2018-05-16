var passport = require('passport')

module.exports = function (server) {
    console.log('* Login Routes Loaded Into Server');
    
    server.get('/login', 
        function(req, res) {
            res.render('public assets/pages/login', {
                title: "Login",
                message_login: req.flash('loginMessage'),
                message_signup : req.flash('signupMessage')
            });
        }
    );

    server.post('/login', 
        passport.authenticate('local-login', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        })
    );

    server.post('/signup', 
        passport.authenticate('local-signup', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        })
    );

    server.get('/logout', 
        function(req, res) {
            req.logout();
            res.redirect('/');
        }
    );
}