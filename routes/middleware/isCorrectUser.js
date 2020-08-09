const createError = require('http-errors');

module.exports = (req, res, next) => {
    if (req.user == 'undefined')
        throw new Error(createError(401, `You need to login to view your settings`))

    else if (res.locals.user == null)
        throw new Error(createError(404, `You are trying to access settings for a user that does not exist`))

    else if(req.user == undefined)
        throw new Error(createError(401, `You cant acess ${res.locals.user.local.username}'s settings`))

    else if (res.locals.user.permissions.user_private_key != req.user.permissions.user_private_key)
        throw new Error(createError(401, `You cant acess ${res.locals.user.local.username}'s settings`))

    else
        next()

}