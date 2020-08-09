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

    server.post('/login',
        passport.authenticate('local-login', {
            successRedirect: '/loginRedirect', 
            failureRedirect: '/login', 
            failureFlash: true 
        })
    );

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
