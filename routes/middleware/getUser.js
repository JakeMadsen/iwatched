const createError = require('http-errors');
const userService = require('../services/users')

module.exports = async (req, res, next) => {

    let user = await userService.getOne(req.params.id)

    if(!user)
        throw new Error (createError(404, "No user found"))


    res.locals.user = user;
    return next();
}