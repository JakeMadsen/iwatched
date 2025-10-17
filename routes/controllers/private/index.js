const isLoggedIn = require('../../middleware/isLoggedIn')
const templatePath = 'private assets/template.ejs';

module.exports = (server) => {
    console.log('* Index Routes Loaded Into Server');


    server.get('/admin', isLoggedIn, async (req, res) => {
        const metrics = require('../../../bin/server/metrics');
        const mongoose = require('mongoose');
        const snapshot = metrics.snapshot(mongoose);
        // Basic user activity metrics
        let dau = 0, wau = 0, newSignups24h = 0, retention7d = 0;
        let supportNew24h = 0, supportOpen = 0;
        let activeUsers5m = 0;
        try {
            const User = require('../../../db/models/user');
            const UserSession = require('../../../db/models/userSession');
            const Support = require('../../../db/models/supportMessages');
            const now = new Date();
            const dayAgo = new Date(now.getTime() - 24*60*60*1000);
            const weekAgo = new Date(now.getTime() - 7*24*60*60*1000);
            const fiveMinAgo = new Date(now.getTime() - 5*60*1000);
            const twoWeeksAgo = new Date(now.getTime() - 14*24*60*60*1000);
            dau = (await UserSession.distinct('user_id', { last_seen_at: { $gte: dayAgo }, revoked: false })).length;
            wau = (await UserSession.distinct('user_id', { last_seen_at: { $gte: weekAgo }, revoked: false })).length;
            newSignups24h = await User.countDocuments({ 'profile.registration_date': { $gte: dayAgo } });
            const registeredBefore = await User.countDocuments({ 'profile.registration_date': { $lt: weekAgo } });
            const activeLast7 = (await UserSession.distinct('user_id', { last_seen_at: { $gte: weekAgo }, revoked: false })).length;
            retention7d = registeredBefore ? Math.round((activeLast7/registeredBefore)*100) : 0;
            supportNew24h = await Support.countDocuments({ opened_date: { $gte: dayAgo } });
            supportOpen = await Support.countDocuments({ resolved: false });
            activeUsers5m = (await UserSession.distinct('user_id', { last_seen_at: { $gte: fiveMinAgo }, revoked: false })).length;
        } catch(_) {}

        res.render(templatePath, {
            page_title: "iWatched - Admin",
            page_file: "index",
            page_data: {
                users_online: activeUsers5m,
                metrics: snapshot,
                activity: { dau, wau, newSignups24h, retention7d },
                support: { new24h: supportNew24h, open: supportOpen }
            },
            user: req.user
        })
    });

    // Live metrics JSON for dashboard polling
    server.get('/admin/metrics.json', isLoggedIn, async (req, res) => {
        try {
            const metrics = require('../../../bin/server/metrics');
            const mongoose = require('mongoose');
            const snapshot = metrics.snapshot(mongoose);
            // include active users (5m)
            let activeUsers5m = 0;
            try {
                const UserSession = require('../../../db/models/userSession');
                const fiveMinAgo = new Date(Date.now() - 5*60*1000);
                activeUsers5m = (await UserSession.distinct('user_id', { last_seen_at: { $gte: fiveMinAgo }, revoked: false })).length;
            } catch(_) {}
            res.json(Object.assign({}, snapshot, { activeUsers5m }));
        } catch (e) {
            res.json({});
        }
    });
}
