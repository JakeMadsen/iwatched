module.exports = function (server) {
    console.log('* About Routes Loaded Into Server');
    
    server.get('/about', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - About",
            page_file: "about",
            page_data: {

            },
            user: req.user
        });
    });

    server.get('/faq', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - About",
            page_file: "faq",
            page_data: {

            },
            user: req.user
        });
    });

    server.get('/policy/terms-of-service', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - ToS",
            page_file: "policy-tos",
            page_data: {

            },
            user: req.user
        });
    });


    server.get('/policy/privacy', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Privacy",
            page_file: "policy-privacy",
            page_data: {

            },
            user: req.user
        });
    });
    server.
    get('/policy/community', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Community",
            page_file: "policy-community",
            page_data: {

            },
            user: req.user
        });
    });
}
