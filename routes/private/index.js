// const db_connection = require('../../helpers/db/db_config.js').connect_local();

module.exports = function (server) {
    server.get('/cpanel/', async function(req, res, next){                
        res.render('private assets/pages/index');
    });
}
