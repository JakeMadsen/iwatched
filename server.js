/*=================== iWatched.xyz Server configuration ===================//
#
#
#
//=================== Dependencay ===================//
/* Requires all needed modules for the server. */
const   express         = require('express'),
        path            = require('path'),
        server          = express(),
        bodyParser      = require("body-parser"),
        host_settings   = require('./helpers/tools/oop_server_host'),
        db_connection   = require('./helpers/db/db_config.js').connect_local(),
        createError     = require('http-errors');
        
/* Modules used for development */ 
const   logger          = require('morgan');

/* Modules required for authentication and login */
const   passport        = require('passport'),
        cookieParser    = require('cookie-parser'),
        flash           = require('connect-flash'),
        session         = require('express-session');

/* Host contains usefull server configurations */
var host = new host_settings;
    host.server_name = "iWatched.xyz";


//=================== Configuration ===================//
/* Server development modules */
server.use(logger('dev'));


/* Server view engine setup */
server.set('view engine','ejs');
server.set('views', path.join(__dirname, '/public/views'));
server.use(express.static(__dirname + '/public'))
server.use('/static', express.static('public'));
server.use(express.static(path.join(__dirname + 'public')));


/* Server module setup*/
server.use(bodyParser.urlencoded({ extended: true }));
server.use(bodyParser.json());
server.use(cookieParser())


/* Server passport setup */
// require('./config/passport/passport')(server)
server.use(session({ 
    secret: 'thisIsMySecretCat',
    resave: true,
    saveUninitialized: true
}));
server.use(passport.initialize());
server.use(passport.session()); // persistent login sessions
server.use(flash());

//=================== Routes ===================//
/* Requires public and private WEB routes. */
require('./routes/route_index_public')(server);


/* Server 404/ERROR handler*/
server.use(function(req, res, next) {
    next(createError(404));
});
server.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('public assets/pages/error', {
        title: err.status
    });
});


//=================== Server initialisation ===================//
/* Executes listening function for WEB server. */
server.listen(host.port, () => {
    console.log('======== SERVER - RUNNING ========' +  '\n' + 
                'Server name: ' + host.server_name   +  '\n' + 
                'Server listening at: ' + 'http://'+host.ip_localhost+':'+host.port);
});