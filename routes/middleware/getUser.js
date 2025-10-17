const createError = require('http-errors');
const userService = require('../services/users')

module.exports = async (req, res, next) => {
    let user = await userService.getOne(req.params.id)
    
    if(user == null)
        res.locals.user = null;

    if(user){
        try {
            // Enrich with featured badge info for profile pages
            const fid = user && user.profile && user.profile.featured_badge_id;
            if (fid) {
                const Badge = require('../../db/models/badge');
                const badge = await Badge.findById(fid).lean();
                if (badge) {
                    const owned = Array.isArray(user.profile.user_badges) ? user.profile.user_badges.find(b => String(b.badge_id) === String(fid)) : null;
                    user.profile.featured_badge_info = {
                        id: String(fid),
                        title: badge.title,
                        description: badge.description || '',
                        icon: badge.icon ? ('/static/style/img/badges/' + badge.icon) : null,
                        level: owned && owned.level || 'single',
                        awarded_at: owned && owned.awarded_at || null
                    };
                }
            }
        } catch (_) {}
        res.locals.user = user;
    }

    return next();
}
