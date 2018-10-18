var server = require('../../server'),
    host_settings   = require('./settings')

var portfinder = require('portfinder');
    portfinder.basePort = 3000;
    
portfinder.getPort((err, port) => {
    if(err){
        console.log("Server couldnt find free port. Abort startup.")
    }else {
        var host = new host_settings("iWatched.xyz", port);
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
    }
})