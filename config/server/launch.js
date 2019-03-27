const port = process.env.PORT || 1337;
const server = require('../../server');
const host_settings   = require('./settings');
const host = new host_settings("iWatched.xyz", port);

//=================== Server initialisation ===================//
/* Executes listening function for WEB server. */
server.listen(host.port, () => {
    console.log(
        '======== SERVER - RUNNING ========' +  '\n' + 
        'Server name: ' + host.server_name   +  '\n' + 
        'Server - local - listening at: '  + 'http://'+host.ip_localhost + ':' + host.port  +  '\n' +
        'Server - Public - listening at: ' + 'http://'+host.ip_public    + ':' + host.port
    );
});
