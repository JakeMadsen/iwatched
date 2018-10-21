const userService = require('../../services/users')
const getUser = require('../../middleware/getUser')
module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');
    
    server.get('/:id', getUser, (req, res, next) => {
        if(res.locals.user == null)
            return next('route')

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: "main",
            page_data: {
                user: res.locals.user
            },
            user: req.user
        });
    });
}
