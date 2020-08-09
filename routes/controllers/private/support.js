const supportServices = require('../../services/support');
const support = require('../../services/support');

module.exports = (server) => {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/admin/support', async (req, res) => {
        res.render('private assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "support",
            sub_page_file: null,
            page_data: {

            },
            user: req.user
        });
    });

    server.get('/admin/support/cases/open', async (req, res) => {
        supportServices
        .getAllOpenCases()
        .then(openCases => {
            res.render('private assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "support",
                sub_page_file: "open",
                page_data: {
                    open_cases: openCases
                },
                user: req.user
            });
        })
        .catch(error => {
            console.log(error)
        })
    });

    server.get('/admin/support/cases/closed', async (req, res) => {
        supportServices
        .getAllClosedCases()
        .then(closedCases => {
            res.render('private assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "support",
                sub_page_file: "closed",
                page_data: {
                    closed_cases: closedCases
                },
                user: req.user
            });
        })
        .catch(error => {
            console.log(error)
        })
    });

    server.get('/admin/support/case/respond/:case_id', async (req, res) => {
        supportServices
        .getOneCase(req.params.case_id)
        .then(foundCase => {
            supportServices.seenBySupport(req.params.case_id);
            res.render('private assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "support",
                sub_page_file: "respond",
                page_data: {
                    found_case: foundCase,
                    message: false
                },
                user: req.user
            });
        })
    });

    server.post('/admin/support/case/respond/:case_id', async (req, res) => {
        supportServices
        .sendNewMessageSupport(req.params.case_id, req.body)
        .then(savedCase => {
            supportServices.seenBySupport(req.params.case_id);
            res.render('private assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "support",
                sub_page_file: "respond",
                page_data: {
                    found_case: savedCase,
                    message: false
                },
                user: req.user
            });
        })
    });

    server.post('/admin/support/case/close/:case_id', async (req, res) => {
        supportServices
        .closeCase(req.params.case_id)
        .then(savedCase => {
            supportServices.seenBySupport(req.params.case_id);
            res.redirect('/admin/support/cases/open')
        })
        .catch(error => {
            res.redirect('/admin/support/cases/open')
        })
    });

    server.post('/admin/support/case/delete/:case_id', async (req, res) => {
        supportServices
        .deleteCase(req.params.case_id)
        .then( () => {
            res.redirect('/admin/support/cases/closed')
        })
        .catch(error => {
            console.log(error)
            res.redirect('/admin/support/cases/closed')
        })
    });
}
