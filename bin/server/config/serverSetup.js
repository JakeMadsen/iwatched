/*=================== iWatched Server configuration ===================//
#
#
#
//=================== Dependencies ===================//
/* Requires all needed modules for the app. */
const   express         = require('express'),
        path            = require('path'),
        app             = express(),
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
        mongoose        = require('mongoose'),
        mongoStore      = require('connect-mongo')(session);



/* Server settings */
var     serverSettings  = require('./serverSettings');
        serverSettings  = new serverSettings();
        process.env['SERVER_SETTINGS'] = JSON.stringify (serverSettings);

//=================== Configuration ===================//
/* Server development modules */
// app.use(logger('dev'));

process.env['SERVER_DEV'] = true;


/* Server view engine setup */
app.set('view engine','ejs');
app.set('views', path.join(__dirname, '../../../views'));
// Serve static assets from public
const publicDir = path.join(__dirname, '../../../public');
app.use(express.static(publicDir));
app.use('/static', express.static(publicDir));



/* Server module setup*/
app.use(fileUpload());
// Metrics middleware: track RPS, latency, errors, auth failures
try { app.use(require('../metrics').middleware); } catch (e) {}
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser())


/* Server Database Connection  */
const mongoUri = process.env.MONGO_URI || serverSettings._mongoDB;

if (!mongoUri || typeof mongoUri !== 'string' || !mongoUri.trim()) {
    console.error('[Startup] Missing Mongo connection string. Set `MONGO_URI` env var.');
}

// Prefer modern connection options for stability
mongoose
    .connect(mongoUri, {
        useCreateIndex: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000
    })
    .catch(err => {
        console.error('[MongoDB] Connection error:', err && err.message ? err.message : err);
    })

// Helpful diagnostics during startup
try {
    mongoose.connection.on('error', (err) => {
        console.error('[MongoDB] Connection event error:', err && err.message ? err.message : err);
    });
    mongoose.connection.on('connected', () => {
        try { console.log('[MongoDB] Connected'); } catch (_) {}
    });
    mongoose.connection.on('disconnected', () => {
        try { console.warn('[MongoDB] Disconnected'); } catch (_) {}
    });
} catch (_) {}

/* Server User Passport Setup  */
require('../../../config/passport/passport')(passport)
app.use(session({ 
    secret: process.env.SESSION_SECRET || 'thisIsMySecretCat',
    resave: false,
    saveUninitialized: false,
    store: new mongoStore ({ 
        mongooseConnection: mongoose.connection,
        collection: 'user_sessions',
        autoRemove: 'native',
        ttl: 7 * 24 * 60 * 60,
        stringify: true,

    })
    ,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: !!(process.env.NODE_ENV === 'production')
    }
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash());
// Track authenticated sessions with lightweight metadata
try { app.use(require('../../../routes/middleware/trackSession')); } catch (e) {}



//=================== Routes ===================//
/* Requires public and private WEB routes. */
require('../../../routes/controllers/index')(app)

/* Server 404/ERROR handler*/
app.use(function(req, res, next) {
    next(createError(404));
});
app.use(async function(err, req, res, next) {
    
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
        }, 
        user: req.user
    });
});

module.exports = app
