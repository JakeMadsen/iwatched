var LocalStrategy = require('passport-local').Strategy;
var User = require('../../db/models/user');
var BannedAccount = require('../../db/models/bannedAccount');


module.exports = (passport) => {

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) => {
            done(err, user);
        });
    });

    passport.use('local-signup', new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true,

    },
    function (req, username, password, done) {
        process.nextTick(function () {
            // Validate username: only letters and numbers
            const uname = String(username||'');
            if (!/^[A-Za-z0-9]+$/.test(uname)){
                return done(null, false, req.flash('signupMessage', 'Username may contain only letters and numbers.'));
            }
            if (uname.length < 3 || uname.length > 24){
                return done(null, false, req.flash('signupMessage', 'Username must be 3-24 characters.'));
            }

            // First, reject if email/IP is banned
            try {
                const escapeRegex = (text) => String(text||'').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const email = String(req.body.email||'');
                const rawIp = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '').toString();
                // Ignore loopback/private IPs in dev so you don't lock yourself out
                function isPublicIp(ip){
                    if(!ip) return false;
                    // trim proxies list (take first)
                    ip = String(ip).split(',')[0].trim();
                    // IPv6 loopback
                    if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return false;
                    // IPv4 loopback
                    if (/^127\./.test(ip)) return false;
                    // RFC1918 private ranges
                    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip)) return false;
                    // Link-local
                    if (/^169\.254\./.test(ip)) return false;
                    return true;
                }
                const ip = isPublicIp(rawIp) ? String(rawIp).split(',')[0].trim() : null;
                const emailRx = new RegExp('^' + escapeRegex(email) + '$', 'i');
                BannedAccount.findOne({ $or: [ { email: emailRx }, (ip? { ip } : null) ].filter(Boolean) }, function(err, banned){
                    if (err) return done(err);
                    if (banned) return done(null, false, req.flash('signupMessage', 'This email/IP is banned.'));
                    proceed();
                });
            } catch(_) { proceed(); }

            function proceed(){
              User
            .findOne(
                { $or: [
                    { 'local.email': req.body.email },
                    { 'local.username': username }
                ]}, function (err, user) {
                if (err)
                    return done(err);

                if (user) {
                    let text = null;
                    if(user.local.username == username)
                        text = 'Username'

                    if(user.local.email == req.body.email){
                        if(text != null)
                            text = 'Username and Email'
                        else
                            text = 'Email'
                    }
                    return done(null, false, req.flash('signupMessage', `That ${text} is already taken.`));
                } else {

                    var newUser = new User();
                        newUser.initialSignup(username, req.body.email, password)
                        // Temporary: mark all newly created users as beta testers
                        try { newUser.profile = newUser.profile || {}; newUser.profile.flags = newUser.profile.flags || {}; newUser.profile.flags.beta_tester = true; } catch (e) {}

                    newUser.save((err) => {
                        if (err) throw err;
                        return done(null, newUser);
                    });
                }
            })
            }
        });
    }));

    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    passport.use('local-login', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true 
    },
        function (req, login, password, done) { 
            const escaped = escapeRegex(login || '');
            User.findOne({$or: [
                {'local.email': new RegExp('^' + escaped + '$', 'i') },
                {'local.username': new RegExp('^' + escaped + '$', 'i')}
            ]}, function (error, user) {

                if (error)
                    return done(null, false, req.flash('flash', {'error': error, 'login' : login})); 

                if (!user)
                    return done(null, false, req.flash('flash', {'error': 'No user found', 'login' : login})); 

                if (!user.validPassword(password))
                    return done(null, false, req.flash('flash', {'error': 'Wrong password', 'login' : login}));

                return done(null, user);
            });
        })
    );
};
