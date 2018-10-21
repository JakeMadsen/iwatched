const createError = require('http-errors');
const userService = require('../services/users')

module.exports = async (req, res, next) => {
    let user = await userService.getOne(req.params.id)
    
    if(user == null)
        res.locals.user = null;

    if(user)
        res.locals.user = user;

    return next();
}