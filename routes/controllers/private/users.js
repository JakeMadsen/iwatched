const isLoggedIn = require('../../middleware/isLoggedIn')
const templatePath = 'private assets/template.ejs';
const userService =  require('../../services/users');
const User = require('../../../db/models/user');
const hat = require('hat');
const BannedAccount = require('../../../db/models/bannedAccount');
const UserSession = require('../../../db/models/userSession');
const ModeratorPersona = require('../../../db/models/moderatorPersona');


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
            if (typeof req.body.custom_url !== 'undefined') u.profile.custom_url = (req.body.custom_url||'');
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
            if (req.body.plan) {
                const prevPlan = u.account.plan || 'free';
                const nextPlan = String(req.body.plan);
                u.account.plan = nextPlan;
                if (prevPlan !== 'premium' && nextPlan === 'premium') {
                    u.account.premium_since = new Date();
                    u.account.premium_until = null;
                    try { u.profile.flags.premium = true; } catch(e){}
                } else if (prevPlan === 'premium' && nextPlan !== 'premium') {
                    u.account.premium_until = new Date();
                    try { u.profile.flags.premium = false; } catch(e){}
                }
            }

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

    // Ban + Delete account
    server.post('/admin/users/:id([0-9a-fA-F]{24})/ban_delete', isLoggedIn, async (req, res) => {
        try {
            const u = await User.findById(req.params.id).lean();
            if (!u) return res.redirect('/admin/users');
            const email = u.local && u.local.email ? String(u.local.email) : null;
            // Prefer user's last known session IP
            let ip = null;
            try {
                const lastSession = await UserSession.find({ user_id: u._id }).sort({ last_seen_at: -1 }).limit(1).lean();
                ip = (lastSession && lastSession[0] && lastSession[0].ip) ? String(lastSession[0].ip) : null;
            } catch(_){}
            if (!ip) ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '').toString();
            const hwid = (req.body && req.body.hardware_id) ? String(req.body.hardware_id) : null;
            const reason = (req.body && req.body.reason) ? String(req.body.reason) : '';
            // Resolve moderator display name (persona > username)
            let moderator_name = null;
            try {
                const persona = await ModeratorPersona.findOne({ assigned_user_id: req.user._id }).lean();
                if (persona && persona.name) moderator_name = persona.name;
                else if (req.user && req.user.local && req.user.local.username) moderator_name = req.user.local.username;
            } catch(_){}
            if (email) {
                try {
                    await BannedAccount.create({ email, ip, hardware_id: hwid, reason, moderator_id: req.user._id, moderator_name: moderator_name || null, date_banned: new Date() });
                } catch (e) { /* ignore dup */ }
            }
            await User.deleteOne({ _id: req.params.id });
            return res.redirect('/admin/bans?ok=1');
        } catch (e) {
            console.error('Ban+Delete failed:', e && e.message);
            return res.redirect(`/admin/users/${req.params.id}?err=1`);
        }
    });

    // Admin: create new user (for testing)
    server.get('/admin/users/create', isLoggedIn, async (req, res) => {
        res.render(templatePath, { page_title: 'Admin - Create User', page_file: 'user_create', page_data: {}, user: req.user });
    });
    server.post('/admin/users/create', isLoggedIn, async (req, res) => {
        try {
            const username = (req.body.username||'').trim();
            const email = (req.body.email||'').trim();
            const password = (req.body.password||'').trim() || 'Password123!';
            if (!username || !email) return res.redirect('/admin/users/create?err=1');
            const exists = await User.findOne({ $or:[ { 'local.username': username }, { 'local.email': email } ] }).lean();
            if (exists) return res.redirect('/admin/users/create?err=exists');
            // Banned check
            const escapeRx = (t)=>String(t||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
            const banned = await BannedAccount.findOne({ email: new RegExp('^'+escapeRx(email)+'$', 'i') }).lean();
            if (banned) return res.redirect('/admin/users/create?err=banned');
            const u = new User(); u.initialSignup(username, email, password);
            await u.save();
            return res.redirect(`/admin/users/${u._id}?ok=1`);
        } catch (e) { return res.redirect('/admin/users/create?err=1'); }
    });

    // Bans list
    server.get('/admin/bans', isLoggedIn, async (req, res) => {
        let list = await BannedAccount.find({}).sort({ date_banned: -1 }).lean();
        try {
            // Enrich with moderator display name if missing
            const modIds = Array.from(new Set(list.map(b => String(b.moderator_id||'')).filter(Boolean)));
            const users = await User.find({ _id: { $in: modIds } }).select('_id local.username').lean();
            const personas = await ModeratorPersona.find({ assigned_user_id: { $in: modIds } }).select('assigned_user_id name').lean();
            const uMap = new Map(users.map(u => [String(u._id), (u.local && u.local.username) || '']));
            const pMap = new Map(personas.map(p => [String(p.assigned_user_id), p.name]));
            list = list.map(b => Object.assign({}, b, { moderator_label: (b.moderator_name || pMap.get(String(b.moderator_id)) || uMap.get(String(b.moderator_id)) || String(b.moderator_id||'')) }));
        } catch(_){}
        res.render(templatePath, { page_title: 'Admin - Banned Users', page_file: 'bans', page_data: { bans: list, ok: req.query.ok }, user: req.user });
    });
    server.post('/admin/bans/add', isLoggedIn, async (req, res) => {
        try {
            const email = (req.body.email||'').trim(); if (!email) return res.redirect('/admin/bans?err=1');
            await BannedAccount.create({ email, ip: (req.body.ip||'').trim()||null, hardware_id: (req.body.hardware_id||'').trim()||null, reason: (req.body.reason||'').trim(), moderator_id: req.user._id });
            return res.redirect('/admin/bans?ok=1');
        } catch (_) { return res.redirect('/admin/bans?err=1'); }
    });
    server.post('/admin/bans/:id([0-9a-fA-F]{24})/delete', isLoggedIn, async (req, res) => {
        try { await BannedAccount.deleteOne({ _id: req.params.id }); } catch(_){}
        return res.redirect('/admin/bans?ok=1');
    });
}
