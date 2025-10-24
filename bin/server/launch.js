require('dotenv').config();
const app = require('./config/serverSetup');
const server = require('http').createServer(app)
const serverSettings = JSON.parse(process.env['SERVER_SETTINGS']);
// Prefer Fly's PORT, then config, then sensible default
const serverPort = process.env.PORT || serverSettings._serverPort || 3000;
// Bind to IPv6 unspecified by default so Fly's IPv6 network can reach us
const bindHost = process.env.BIND || '::';
const mongoose = require('mongoose');

//=================== Server initialisation ===================//
/* Start server only after MongoDB is ready to avoid request buffering timeouts */
let started = false;
const startServer = () => {
  if (started) return; started = true;
  console.clear()
  const maskedMongo = '[redacted]';
  // Explicitly bind so it listens on all interfaces (IPv6/IPv4)
  server.listen(serverPort, bindHost, () => {
    console.log(`======== \x1b[32m SERVER - RUNNING \x1b[0m ======= \n` +
                `Website name   : \x1b[33m ${serverSettings._websiteName} \x1b[0m \n` +
                `Server name    : \x1b[33m ${serverSettings._serverName} \x1b[0m \n` +
                `Server MongoDB connection  : \x1b[33m ${maskedMongo} \x1b[0m \n` +
                `Server listening local     : \x1b[36m http://${serverSettings._ipLocalhost}:${serverPort} \x1b[0m \n` +
                `Server listening public    : \x1b[36m http://${serverSettings._ipPublic}:${serverPort} \x1b[0m`);
  });
};

// Wait for a successful DB connection (or time out with a clear error)
const failTimeout = setTimeout(() => {
  if (!started) {
    console.error('[Startup] Timed out waiting for MongoDB connection. Check MONGO_URI and network/IP allowlist.');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('[Startup] Continuing without DB connection (dev mode). Some features will not work.');
      startServer();
    }
  }
}, 20000);

// Start listening immediately so the platform health checks can connect.
// DB readiness is handled independently via logs and feature-level errors.
startServer();

// Still report DB readiness for visibility
if (mongoose.connection.readyState !== 1) {
  mongoose.connection.once('open', () => { /* DB ready */ });
  mongoose.connection.on('error', (err) => {
    console.error('[Startup] MongoDB connection failed:', err && err.message ? err.message : err);
  });
}

const socketIo = require('socket.io').listen(server);
require('./socketHub').setIo(socketIo);

process.env['USERS_ONLINE'] = 0;

/* Socket.IO user tracking */
socketIo.on('connection', (socket) => {
    process.env['USERS_ONLINE']++

    socket.on('disconnect', () => {
        process.env['USERS_ONLINE']--
      });
})

// Developer-friendly error logging to avoid silent crashes in dev
if (process.env.NODE_ENV !== 'production') {
  process.on('unhandledRejection', (reason) => {
    try { console.error('\n[UnhandledRejection]', reason && reason.stack || reason); } catch (_) {}
  });
  process.on('uncaughtException', (err) => {
    try { console.error('\n[UncaughtException]', err && err.stack || err); } catch (_) {}
  });
}
