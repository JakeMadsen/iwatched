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
const   https           = require('https');



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

// Serve profile images from S3 (Tigris) under the same URLs if configured
let storage = null;
try { storage = require('./storage'); } catch (_) { storage = null; }
const useS3ProfileImages = !!(storage && storage.isEnabled && storage.isEnabled());

if (useS3ProfileImages) {
    // Proxy profile images path to object storage to preserve existing URLs in views
    app.get('/static/style/img/profile_images/users/:userId/:fileName', (req, res) => {
        const userId = String(req.params.userId || '');
        const fileName = String(req.params.fileName || '');
        const key = `style/img/profile_images/users/${userId}/${fileName}`;
        const cacheHeaders = {
            'Cache-Control': 'public, max-age=60',
        };
        if (!storage || typeof storage.streamToResponse !== 'function' || !storage.streamToResponse(req, res, key, cacheHeaders)) {
            try { res.status(404).end(); } catch (_) {}
        }
    });
}

// Static assets from local public dir
app.use(express.static(publicDir));
app.use('/static', express.static(publicDir));



/* Server module setup*/
// Harden file uploads (avatars/banners)
app.use(fileUpload({
    limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE_BYTES || (5 * 1024 * 1024)) },
    abortOnLimit: true,
    safeFileNames: true,
    preserveExtension: true,
}));
// Metrics middleware: track RPS, latency, errors, auth failures
try { app.use(require('../metrics').middleware); } catch (e) {}
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser())
// trust proxy so req.secure reflects X-Forwarded-Proto (needed for secure cookies behind proxies)
try { app.set('trust proxy', 1); } catch (_) {}


/* Server Database Connection  */
const mongoUri = process.env.MONGO_URI || serverSettings._mongoDB;

if (!mongoUri || typeof mongoUri !== 'string' || !mongoUri.trim()) {
    console.error('[Startup] Missing Mongo connection string. Set `MONGO_URI` env var.');
}

// Small helper to log the app's public egress IP (useful for Atlas allowlist)
function logPublicIP(prefix){
    try {
        const req = https.get('https://api.ipify.org?format=json', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const ip = JSON.parse(data||'{}').ip;
                    if (ip) console.error(prefix + ' Detected public IP:', ip);
                } catch (_) {}
            });
        });
        req.on('error', () => {});
        req.setTimeout(3000, () => { try { req.abort(); } catch(_){} });
    } catch (_) {}
}

async function connectWithFallback(){
    const primary = mongoUri;
    const fallback = process.env.MONGO_URI_FALLBACK || process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/iwatched';
    const opts = {
        useCreateIndex: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000
    };
    try {
        await mongoose.connect(primary, opts);
        return 'primary';
    } catch (err) {
        console.error('[MongoDB] Connection error:', err && err.message ? err.message : err);
        logPublicIP('[MongoDB]');
        // Try fallback only for common DNS/SRV issues or if explicitly provided
        const isDnsErr = /ENOTFOUND|EAI_AGAIN|querySrv/i.test(String(err && (err.code || err.message)));
        if (fallback && (isDnsErr || process.env.MONGO_URI_FALLBACK || process.env.MONGO_URI_LOCAL)){
            try {
                console.warn('[MongoDB] Trying fallback connection URI');
                await mongoose.connect(fallback, opts);
                return 'fallback';
            } catch (err2) {
                console.error('[MongoDB] Fallback connection error:', err2 && err2.message ? err2.message : err2);
                logPublicIP('[MongoDB]');
            }
        }
        throw err;
    }
}

// Prefer modern connection options for stability
connectWithFallback().catch(()=>{});

// Helpful diagnostics during startup
try {
    mongoose.connection.on('error', (err) => {
        console.error('[MongoDB] Connection event error:', err && err.message ? err.message : err);
        logPublicIP('[MongoDB]');
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
        // auto = only set secure when req.secure is true (works with proxies when trust proxy is set)
        secure: 'auto'
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
