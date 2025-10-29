module.exports = function (server) {
    console.log('* About Routes Loaded Into Server');
    
    server.get('/about', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched - About",
            page_file: "about",
            page_data: {

            },
            user: req.user
        });
    });

    server.get('/faq', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched - About",
            page_file: "faq",
            page_data: {

            },
            user: req.user
        });
    });

    server.get('/policy/terms-of-service', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched - ToS",
            page_file: "policy-tos",
            page_data: {

            },
            user: req.user
        });
    });


    server.get('/policy/privacy', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Privacy",
            page_file: "policy-privacy",
            page_data: {

            },
            user: req.user
        });
    });
    server.get('/policy/community', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Community",
            page_file: "policy-community",
            page_data: {

            },
            user: req.user
        });
    });

    // Global search results page
    server.get('/search', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Search",
            page_file: "search",
            page_data: {
                q: (req.query.q || '').toString()
            },
            user: req.user
        });
    });

    // Minimal page to debug nav/search in isolation
    server.get('/nav-test', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Nav Test",
            page_file: "nav-test",
            page_data: {},
            user: req.user
        });
    });
}
