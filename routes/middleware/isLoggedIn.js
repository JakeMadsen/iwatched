module.exports = (req, res, next) => {
    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
    return next();

    res.redirect('/login')
}