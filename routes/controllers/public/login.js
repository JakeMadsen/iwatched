const passport = require('passport')

module.exports = (server) => {
    console.log('* Login Routes Loaded Into Server');
    
    server.get('/login', async (req, res) => {
        if(typeof req.user != 'undefined')
            res.redirect('/loginRedirect')

        else
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Sign in/up",
            page_file: "login",
            page_data: {
                login_error: req.flash(),
                signup_error: req.flash()
            },
            user: req.user
        });
    });

    server.post('/login', (req, res, next) => {
        passport.authenticate('local-login', (err, user, info) => {
            if (err) return next(err);
            if (!user) return res.redirect('/login');
            req.logIn(user, (err) => {
                if (err) return next(err);
                try {
                    if (req.body && (req.body.remember === '1' || req.body.remember === 'on' || req.body.remember === 'true')) {
                        // Persist cookie across browser restarts (align with store TTL: 7 days)
                        req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
                    } else {
                        // Session cookie (expires when browser closes)
                        req.session.cookie.expires = false;
                        req.session.cookie.maxAge = null;
                    }
                } catch (e) { /* noop */ }
                return res.redirect('/loginRedirect');
            });
        })(req, res, next);
    });

    server.post('/signup',
        passport.authenticate('local-signup', {
            successRedirect: '/loginRedirect', 
            failureRedirect: '/login', 
            failureFlash: true 
        })
    );

    server.get('/logout', (req, res) => {

            req.logout();
            res.redirect('/login');
    });

    server.get('/loginRedirect', (req, res) => {
        if(typeof req.user != 'undefined'){
            if(req.user.profile.custom_url != null && req.user.profile.custom_url != '')
                res.redirect(`/${req.user.profile.custom_url}`)
            else
                res.redirect(`/${req.user._id}`)
        }
            
        else
            res.redirect('/login')
    })
}
