/*=================== iWatched Server configuration ===================//
#
#
#
//=================== Dependencay ===================//
/* Requires all needed modules for the server. */
const   express         = require('express'),
        path            = require('path'),
        server          = express(),
        bodyParser      = require("body-parser"),
        createError     = require('http-errors'),
        fileUpload      = require('express-fileupload')
        
/* Modules used for development */ 
const   logger          = require('morgan');

/* Modules required for authentication and login */
const   passport        = require('passport'),
        cookieParser    = require('cookie-parser'),
        flash           = require('connect-flash'),
        session         = require('express-session'),
        mongoose        = require('mongoose');

/* Host contains server settings */



//=================== Configuration ===================//
/* Server development modules */
// server.use(logger('dev'));


/* Server view engine setup */
server.set('view engine','ejs');
server.set('views', path.join(__dirname, '/views'));
server.use(express.static(__dirname + '/public'))
server.use('/static', express.static('public'));
server.use(express.static(path.join(__dirname + 'public')));


/* Server module setup*/
server.use(fileUpload());
server.use(bodyParser.urlencoded({ extended: true }));
server.use(bodyParser.json());
server.use(cookieParser())


/* Server Database Connection  */
mongoose.connect('mongodb+srv://JakeTheDane:Acq59hhc.@maincluster-r0dde.mongodb.net/iwatched', { useNewUrlParser: true }).then(connection => {
    console.log("Database connection succesful")

}).catch(err => {
    console.log("Database connection failure: " + err)
})

/* Server User Passport Setup  */
require('./config/passport/passport')(passport)
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
require('./routes/controllers/index')(server)

/* Server 404/ERROR handler*/
server.use(function(req, res, next) {
    next(createError(404));
});
server.use(async function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('public assets/template.ejs', {
        page_title: `iWatched - ${err.status}` ,
        page_file: "error",
        page_data: {
            error: {
                status: err.status,
                message: err.message,
                stack: err.stack
            }
        }
    });
});

module.exports = server