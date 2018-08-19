var passport = require('passport')
var mongoose = require('../../config/db/mongdb').connect();
var User = require('../../models/user');

mongoose.on('error', console.error.bind(console, 'connection error:'));
mongoose.once('open', function() {
//   console.log("connection successfull")
});

module.exports = function (server) {
    // =========================================================================
    // USER VISITING PAGE ======================================================
    // =========================================================================
    console.log('* Visit Routes Loaded Into Server');

    server.get('/visit',
        function (req, res) {
            res.render('public assets/pages/visit', {
                title: `visit`,
                page: 'search',
                search: true,
                user: req.user,
            });
        }
    );

    server.get('/visit/:username',
        async function (req, res) {
            let userData = null;
            let error = false;
            
            try {
                userData = await getUser(req.params.username);

                // if(userData.local.private == true)
                //     error = true

            } catch (err){
                console.log(err)
                error = true;
            } finally {
                res.render('public assets/pages/visit', {
                    title: `visit ${req.params.username}`,
                    page: 'main',
                    userName: req.params.username,
                    userData: userData,
                    user: req.user,
                    search: false,
                    error: error
                });
            }
        }
    );

    server.get('/visit/:username/:page',
        async function (req, res) {
            let userData = null;
            let error = false;
            
            try {
                userData = await getUser(req.params.username);
                

                if(userData.local.private == true)
                    error = true

            } catch (err){
                console.log(err)
                error = true;
            } finally {
                res.render('public assets/pages/visit', {
                    title: `visit ${req.params.username}`,
                    page: req.params.page,
                    userName: req.params.username,
                    userData: userData,
                    user: req.user,
                    search: false,
                    error: error
                });
            }
        }
    );
}


/* getUser gets the users profile by checking the url parameter */
function getUser(username){
    return new Promise(function(resolve, reject){
        
        User.findOne({ 'local.username': username }, function(err, user){
            if(err)
                return reject(err)
            else if(!user)
                return reject("No user found")
            else
                resolve(user)
        })
    })

}