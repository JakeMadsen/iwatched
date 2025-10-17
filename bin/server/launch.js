require('dotenv').config();
const app = require('./config/serverSetup');
const server = require('http').createServer(app)
const serverSettings = JSON.parse(process.env['SERVER_SETTINGS']);
const serverPort = process.env.PORT || serverSettings._serverPort;
const mongoose = require('mongoose');

//=================== Server initialisation ===================//
/* Start server only after MongoDB is ready to avoid request buffering timeouts */
let started = false;
const startServer = () => {
  if (started) return; started = true;
  console.clear()
  const maskedMongo = '[redacted]';
  server.listen(serverPort, () => {
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
    process.exit(1);
  }
}, 20000);

if (mongoose.connection.readyState === 1) {
  startServer();
  clearTimeout(failTimeout);
} else {
  mongoose.connection.once('open', () => { startServer(); clearTimeout(failTimeout); });
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
