var passport = require('passport')

module.exports = function (server) {
    console.log('* Profile Routes Loaded Into Server');
    
    server.get('/profile', isLoggedIn, 
        function(req, res) {
            res.render('public assets/pages/profile', {
                title: "Profile",
                user : req.user // get the user out of session and pass to template
            });
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
