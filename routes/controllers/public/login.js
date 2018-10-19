const passport = require('passport')

module.exports = (server) => {
    console.log('* Login Routes Loaded Into Server');
    
    server.get('/login', async (req, res) => {
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Sign in/up",
            page_file: "login",
            page_data: {
                message_login: req.flash('loginMessage'),
                message_signup: req.flash('signupMessage')
            },
            user: req.user
        });
    });

    server.post('/login',
        passport.authenticate('local-login', {
            successRedirect: '/profile', 
            failureRedirect: '/login', 
            failureFlash: true 
        })
    );

    server.post('/signup',
        passport.authenticate('local-signup', {
            successRedirect: '/profile', 
            failureRedirect: '/login', 
            failureFlash: true 
        })
    );

    server.get('/logout',
        function (req, res) {
            req.logout();
            res.redirect('/login');
        }
    );
}
