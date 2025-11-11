const createError = require('http-errors');
const userService = require('../services/users');



module.exports = async (req, res, next) => {
    try {
        const key = req.body && req.body.user_key;
        const uid = req.body && req.body.user_id;
        if (!key || !uid) {
            return res.status(401).send({ status: 401, message: 'Unauthorized: missing user_id or user_key' });
        }
        const user = await userService.getOne(uid);
        const ok = !!(user && user.permissions && user.permissions.user_private_key === key);
        if (!ok) {
            return res.status(401).send({ status: 401, message: 'Unauthorized: invalid user_key for user_id' });
        }
        return next();
    } catch (e) {
        try { console.warn('apiIsCorrectUser failed:', e && e.message ? e.message : e); } catch(_){}
        return res.status(401).send({ status: 401, message: 'Unauthorized: middleware error' });
    }
}
