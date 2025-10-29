const supportServices = require('../../services/support');
const support = require('../../services/support');
const isLoggedIn = require('../../middleware/isLoggedIn');
const ModeratorPersona = require('../../../db/models/moderatorPersona');

module.exports = (server) => {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/admin/support', isLoggedIn, async (req, res) => {
        res.render('private assets/template.ejs', {
            page_title: "iWatched - Home",
            page_file: "support",
            sub_page_file: null,
            page_data: {

            },
            user: req.user
        });
    });

    server.get('/admin/support/cases/open', isLoggedIn, async (req, res) => {
        supportServices
        .getAllOpenCases()
        .then(openCases => {
            res.render('private assets/template.ejs', {
                page_title: "iWatched - Home",
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

    server.get('/admin/support/cases/closed', isLoggedIn, async (req, res) => {
        supportServices
        .getAllClosedCases()
        .then(closedCases => {
            res.render('private assets/template.ejs', {
                page_title: "iWatched - Home",
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

    server.get('/admin/support/case/respond/:case_id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
        supportServices
        .getOneCase(req.params.case_id)
        .then(async foundCase => {
            supportServices.seenBySupport(req.params.case_id);
            // Enrich messages with user avatars for user posts
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
            res.render('private assets/template.ejs', {
                page_title: "iWatched - Home",
                page_file: "support",
                sub_page_file: "respond",
                page_data: {
                    found_case: foundCase,
                    message: req.query.ok ? 'sent' : false
                },
                user: req.user
            });
        })
    });

    server.post('/admin/support/case/respond/:case_id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
        try {
            // Attach persona if available for this support user
            const persona = await ModeratorPersona.findOne({ assigned_user_id: req.user._id }).lean();
            req.body.answered_by = req.user._id;
            req.body.username = persona ? persona.name : (req.user.local && req.user.local.username);
            if (persona) {
                req.body.persona_name = persona.name;
                req.body.persona_avatar = persona.avatar || null;
            }
            await supportServices.sendNewMessageSupport(req.params.case_id, req.body);
            supportServices.seenBySupport(req.params.case_id);
            return res.redirect(`/admin/support/case/respond/${req.params.case_id}?ok=1`);
        } catch (e) {
            console.log('Support respond failed:', e && e.message);
            return res.redirect(`/admin/support/case/respond/${req.params.case_id}`);
        }
    });

    server.post('/admin/support/case/close/:case_id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
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

    server.post('/admin/support/case/delete/:case_id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
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
