const isLoggedIn = require('../../middleware/isLoggedIn')
const userService = require('../../services/users')

module.exports = function (server) {
    console.log('* Index Routes Loaded Into Server');


    server.get('/admin', isLoggedIn, 
        async (req, res) =>{
            console.log("admin")
        }
    );
}