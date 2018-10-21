const isLoggedIn = require('../../middleware/isLoggedIn')
const blacklistedService = require('../../services/blacklist')
const Blacklist = require('../../../db/models/blacklistedUrl')


const templatePath = 'private assets/template.ejs';
module.exports = (server) => {
    console.log('* Blacklist Routes Loaded Into Server');


    server.get('/admin/blacklist', isLoggedIn, async (req, res) => {
        res.render(templatePath, {
            page_title: "iWatched - Admin",
            page_file: "blacklist",
            page_data: {
                blacklistedUrls: await blacklistedService.getAll()
            },
            user: req.user
        })
    });

    server.post('/admin/blacklist', isLoggedIn, async (req, res) => {
        await blacklistedService.blackListPage(req.body)

        res.render(templatePath, {
            page_title: "iWatched - Admin",
            page_file: "blacklist",
            page_data: {
                blacklistedUrls: await blacklistedService.getAll()
            },
            user: req.user
        })
    });
}
