const isLoggedIn = require('../../middleware/isLoggedIn')
const templatePath = 'private assets/template.ejs';
const userService =  require('../../services/users');


module.exports = (server) => {
    console.log('* User Page Routes Loaded Into Server');


    server.get('/admin/users', isLoggedIn, async (req, res) => {

        res.render(templatePath, {
            page_title: "iWatched - Admin",
            page_file: "users",
            page_data: {
                users: await userService.getAll()
            },
            user: req.user
        })
    });
}
