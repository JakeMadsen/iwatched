const supportServices = require('../../services/support');
const support = require('../../services/support');

module.exports = (server) => {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/support', async (req, res) => {

        supportServices
        .getAllCasesFromUser(req.user._id)
        .then(cases => {
            res.render('public assets/template.ejs', {
                page_title: "iWatched - Home",
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
        // Ensure creator info is present
        if (req.user) {
            req.body.opened_by = req.user._id;
            req.body.user_id = req.user._id;
            req.body.username = (req.user.local && req.user.local.username) || '';
        }
        supportServices
        .openNewCase((req.body))
        .then(data => {

            supportServices
            .getAllCasesFromUser(req.user._id)
            .then(cases => {
                res.render('public assets/template.ejs', {
                    page_title: "iWatched - Home",
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
                page_title: "iWatched - Home",
                page_file: "support",
                page_data: {
                    error: true
                },
                user: req.user
            });
        })
    });

    server.get('/support/:case_id([0-9a-fA-F]{24})', async (req, res) => {
        supportServices
        .getOneCase(req.params.case_id)
        .then(async foundCase => {
            supportServices.seenByUser(req.params.case_id);
            // Enrich avatars like admin view
            try {
                const ids = (foundCase.messages||[]).map(m => m.user_id).filter(Boolean);
                if (foundCase.opened_by) ids.push(foundCase.opened_by);
                const uniq = Array.from(new Set(ids.map(String)));
                const users = await require('../../../db/models/user').find({ _id: { $in: uniq } }).select('_id local.username profile.profile_image').lean();
                const map = new Map(users.map(u => [String(u._id), u]));
                (foundCase.messages||[]).forEach(m => {
                    if (m.author_type === 'support') return;
                    const u = m.user_id && map.get(String(m.user_id));
                    if (u) {
                        m.user_avatar = (u.profile && u.profile.profile_image && u.profile.profile_image !== 'profile-picture-missing.png')
                          ? `/static/style/img/profile_images/users/${u._id}/${u.profile.profile_image}`
                          : '/static/style/img/standard/standard_avatar.png';
                        if (!m.username && u.local && u.local.username) m.username = u.local.username;
                    }
                });
            } catch(_) {}
            res.render('public assets/template.ejs', {
                page_title: "iWatched - Home",
                page_file: "support-case",
                page_data: {
                    found_case: foundCase,
                    message: false
                },
                user: req.user
            });
        })
    });

    server.post('/support/:case_id([0-9a-fA-F]{24})', async (req, res) => {
        try {
            req.body.user_id = req.user && req.user._id;
            req.body.username = (req.user && req.user.local && req.user.local.username) || '';
            await supportServices.sendNewMessageUser(req.params.case_id, req.body);
            supportServices.seenByUser(req.params.case_id);
            return res.redirect(`/support/${req.params.case_id}`);
        } catch (e) {
            return res.redirect(`/support/${req.params.case_id}`);
        }
    });

    // Close case (by user)
    server.post('/support/:case_id([0-9a-fA-F]{24})/close', async (req, res) => {
        try { await supportServices.closeCase(req.params.case_id); } catch(_) {}
        return res.redirect(`/support/${req.params.case_id}`);
    });

    // Re-open case (by user)
    server.post('/support/:case_id([0-9a-fA-F]{24})/reopen', async (req, res) => {
        try { await supportServices.reopenCase(req.params.case_id); } catch(_) {}
        return res.redirect(`/support/${req.params.case_id}`);
    });
}
