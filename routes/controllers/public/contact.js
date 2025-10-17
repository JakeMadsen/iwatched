const Message = require('../../../db/models/contactMessages')

module.exports = (server) => {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/contact', async (req, res) => {
        // If user is logged in, redirect to Support area as requested
        if (req.user) {
            return res.redirect('/support');
        }

        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "contact",
            page_data: {
                message: false
            },
            user: req.user
        });
    });

    server.post('/contact', async (req, res) => {
        var newMessage = new Message()
        newMessage.initial(req.body);
        console.log("message", newMessage)

        newMessage.save((error, message) => {
            res.render('public assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "contact",
                page_data: {
                    message: message
                },
                user: req.user
            });

        })
    });
}
