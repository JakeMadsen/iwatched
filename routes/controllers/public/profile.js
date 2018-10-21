const userService = require('../../services/users')
const getUser = require('../../middleware/getUser')
module.exports = (server) => {
    console.log('* Profile Routes Loaded Into Server');
    
    server.get('/:id', getUser, (req, res) => {
        let subFile = "visitProfile";

        if(typeof req.user != 'undefined')
            if(req.params.id == req.user._id)
                subFile = "myProfile"

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "profile",
            page_subFile: subFile,
            page_data: {
                user: res.locals.user
            },
            user: req.user
        });
    });
}
