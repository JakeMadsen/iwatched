const createError = require('http-errors');

module.exports = (req, res, next) => {

    if(!req.user)
        throw new Error (createError(401, "You need to login to view this page."))

    if(req.user.permissions.level.admin != true)
        throw new Error (createError(403, "You don't have permission to view this page."))

    if (req.user.permissions.level.admin == true)
        return next();
        
}