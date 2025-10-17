const isLoggedIn = require('../../middleware/isLoggedIn')
const templatePath = 'private assets/template.ejs';
const userService =  require('../../services/users');
const User = require('../../../db/models/user');
const hat = require('hat');


module.exports = (server) => {
    console.log('* User Page Routes Loaded Into Server');


    server.get('/admin/users', isLoggedIn, async (req, res) => {

        res.render(templatePath, {
            page_title: "iWatched - Admin",
            page_file: "users",
            page_data: {
                users: await userService.getAll()
            },
            user: req.user
        })
    });

    // User edit page
    server.get('/admin/users/:id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
        try {
            const user = await User.findById(req.params.id).lean();
            if (!user) return res.redirect('/admin/users');
            res.render(templatePath, {
                page_title: "iWatched - Admin",
                page_file: "user_edit",
                page_data: { user, ok: req.query.ok, err: req.query.err },
                user: req.user
            });
        } catch (e) {
            res.redirect('/admin/users');
        }
    });

    // Update user data (no password here)
    server.post('/admin/users/:id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
        try {
            const u = await User.findById(req.params.id);
            if (!u) return res.redirect('/admin/users');

            // Local fields
            if (req.body.username) u.local.username = req.body.username.trim();
            if (req.body.email) u.local.email = req.body.email.trim();

            // Profile basics
            u.profile = u.profile || {};
            if (typeof req.body.description !== 'undefined') u.profile.description = req.body.description;
            if (typeof req.body.birthday !== 'undefined') u.profile.birthday = req.body.birthday;
            if (typeof req.body.custom_url !== 'undefined') u.profile.custom_url = (req.body.custom_url||'').toLowerCase();
            if (typeof req.body.visibility !== 'undefined') u.profile.visibility = req.body.visibility;
            u.profile.inactive = (req.body.inactive === 'on' || req.body.inactive === '1' || req.body.inactive === 'true');

            // Flags
            u.profile.flags = u.profile.flags || {};
            u.profile.flags.beta_tester = (req.body.beta_tester === 'on' || req.body.beta_tester === '1' || req.body.beta_tester === 'true');

            // Permissions
            u.permissions = u.permissions || { level: {} };
            u.permissions.level = u.permissions.level || {};
            u.permissions.level.admin = (req.body.is_admin === 'on' || req.body.is_admin === '1' || req.body.is_admin === 'true');

            // Account
            u.account = u.account || {};
            if (req.body.plan) u.account.plan = req.body.plan;

            await u.save();
            return res.redirect(`/admin/users/${u._id}?ok=1`);
        } catch (e) {
            console.error('Admin update user failed:', e && e.message);
            return res.redirect(`/admin/users/${req.params.id}?err=1`);
        }
    });

    // Reset private key
    server.post('/admin/users/:id([0-9a-fA-F]{24})/reset_key', isLoggedIn, async (req, res) => {
        try {
            await User.updateOne({ _id: req.params.id }, { $set: { 'permissions.user_private_key': hat() } });
        } catch (e) { console.error('Reset key failed:', e && e.message); }
        return res.redirect(`/admin/users/${req.params.id}?ok=1`);
    });
}
