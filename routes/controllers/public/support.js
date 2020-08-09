const supportServices = require('../../services/support');
const support = require('../../services/support');

module.exports = (server) => {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/support', async (req, res) => {

        supportServices
        .getAllCasesFromUser(req.user._id)
        .then(cases => {
            res.render('public assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "support",
                page_data: {
                    open_cases: cases.open_cases,
                    closed_cases: cases.closed_cases,
                    message: false
                },
                user: req.user
            });
        })

        
    });

    server.post('/support', async (req, res) => {
        supportServices
        .openNewCase((req.body))
        .then(data => {

            supportServices
            .getAllCasesFromUser(req.user._id)
            .then(cases => {
                res.render('public assets/template.ejs', {
                    page_title: "iWatched.xyz - Home",
                    page_file: "support",
                    page_data: {
                        open_cases: cases.open_cases,
                        closed_cases: cases.closed_cases,
                        message: data
                    },
                    user: req.user
                });
            })
        })
        .catch(error => {
            res.render('public assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "support",
                page_data: {
                    error: true
                },
                user: req.user
            });
        })
    });

    server.get('/support/:case_id', async (req, res) => {
        supportServices
        .getOneCase(req.params.case_id)
        .then(foundCase => {
            supportServices.seenByUser(req.params.case_id);
            res.render('public assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "support-case",
                page_data: {
                    found_case: foundCase,
                    message: false
                },
                user: req.user
            });
        })
    });

    server.post('/support/:case_id', async (req, res) => {
        supportServices
        .sendNewMessageUser(req.params.case_id, req.body)
        .then(savedCase => {
            supportServices.seenByUser(req.params.case_id);
            res.render('public assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "support-case",
                page_data: {
                    found_case: savedCase,
                    message: false
                },
                user: req.user
            });
        })
    });
}
