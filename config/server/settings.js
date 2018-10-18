const server_host = require('ip');


class Host {
    constructor(name, port){
        this.server_name = name
        this.ip_public = server_host.address();
        this.ip_localhost = "localhost";
        this.port = port;
    }
}

module.exports = Host