const isLoggedIn = require('../../middleware/isLoggedIn')
const templatePath = 'private assets/template.ejs';

module.exports = (server) => {
    console.log('* Index Routes Loaded Into Server');


    server.get('/admin', isLoggedIn, (req, res) => {
        res.render(templatePath, {
            page_title: "iWatched - Admin",
            page_file: "index",
            page_data: {
                users_online: process.env['USERS_ONLINE']
            },
            user: req.user
        })
    });
}
