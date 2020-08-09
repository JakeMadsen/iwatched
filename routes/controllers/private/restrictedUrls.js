const isLoggedIn            = require('../../middleware/isLoggedIn');
const restrictedUrlService  = require('../../services/restrictedUrls');
const templatePath = 'private assets/template.ejs';

module.exports = (server) => {
    console.log('* restrictedUrls Routes Loaded Into Server');


    server.get('/admin/restrictedUrls', isLoggedIn, async (req, res) => {
        
        restrictedUrlService
        .getAll()
        .then(urls => {

            res.render(templatePath, {
                page_title: "iWatched - Admin",
                page_file: "restrictedUrls",
                page_data: {
                    restrictedUrls: urls
                },
                user: req.user
            })
        })
        .catch(error => {

        })

        
    });

    server.post('/admin/restrictedUrls', isLoggedIn, async (req, res) => {
        restrictedUrlService
        .create(req.user._id, req.body)
        .then(data => {
            res.redirect('/admin/restrictedUrls')
        })
        
    });
}
