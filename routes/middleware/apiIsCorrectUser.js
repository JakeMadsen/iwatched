const createError = require('http-errors');
const userService = require('../services/users');



module.exports = async (req, res, next) => {
    try {
        let key = req.body.user_key;
        let user = await userService.getOne(req.body.user_id)
        if (!user || (user.permissions && user.permissions.user_private_key) !== key) {
            return res.send({ status: 401, message: "You used the wrong api key" })
        }
        next()
    } catch (e) {
        res.send({ status: 401, message: "Unauthorized" })
    }
}
