const createError = require('http-errors');
const userService = require('../services/users');



module.exports = async (req, res, next) => {
    let key = req.body.user_key;
    let user = await userService.getOne(req.body.user_id)

    if (user.permissions.myKey != key)
        res.send({ status: 401, message: "You used the wrong api key" })

    next()
}