const readlineSync = require ('readline-sync');
const mongoose = require('mongoose');
const fs = require('fs')
const User = require('../../../db/models/user');

var serverSettings = {
    user: {
        username: "admin",
        password: "password"
    },
    serverName: "GalleryWebsite",
    serverPort: 80,
    websiteName: "My Gallery Site",
    mongoDB: null
};

// firstTimeSetup()

module.exports = {
    serverSetup : async () => {
        console.clear();
        console.log('\x1b[36m' + "====== SERVER SETUP ======" + '\x1b[0m');

        /* Server setup questions */
        await serverSetup();

        /* User setup questions */
        await setupUser();

        /* Inserts user into MongoDB collection */
        await createUser(serverSettings.user);
        
        /* Saves settings to json file */
        await saveSettings(serverSettings);

        /* Outputs finished results */
        finished();
        
        return serverSettings
    }
}
async function serverSetup(){
    /* Server Name */
    console.log('\x1b[31m' + "Value cannot contain spaces!" + '\x1b[0m');
    console.log('Default server name is ' + serverSettings.serverName);
    let serverName = readlineSync.question('Choose name for server: ');
    if (serverName != "")
        serverSettings.serverName = serverName;

    /* Server PORT */
    console.clear()
    console.log('\x1b[31m' + "Leave empty if you don't know what this does!" + '\x1b[0m');
    console.log('Default port is ' + serverSettings.serverPort);
    let port = readlineSync.question('Choose server port: ');
    if (port != ""){
        if(parseInt(port)){
            serverSettings.serverPort = parseInt(port);
        }
    }

    /* Website Name */
    console.clear()
    console.log('\x1b[36m' + "Name this whatever you want." + '\x1b[0m');
    console.log('\x1b[36m' + "(This can be changed later)" + '\x1b[0m');
    console.log('Default website name is ' + serverSettings.websiteName);
    let websiteName = readlineSync.question('Choose name for website: ');
    if (websiteName != "")
        serverSettings.websiteName = websiteName;

    /* Mongo Server*/
    let connection = false;
    console.clear();
    do {
    
        console.log('\x1b[36m' + "Enter connection string for mongoDB server" + '\x1b[0m');
        console.log('\x1b[31m' + "This has to be done! You can get one for free at https://www.mongodb.com/" + '\x1b[0m');
        serverSettings.mongoDB = readlineSync.question('Enter connection string: ');
        try {
            console.log("Testing connection.")
            connection = await testConnection(serverSettings.mongoDB);
            console.log("Connection confirmed!")

            sleep(2000);
        } catch (error) {
            connection = false;
            console.log("Something was wrong with the connection string.")
        }
    } while (connection == false)
    
}

async function testConnection(connectionString) {
        return new Promise((resolve, reject) => {
            mongoose.connect(connectionString, { useNewUrlParser: true }).then(connection => {
                mongoose.disconnect();
                resolve(true)
            }).catch(error => {
                reject(false)
            })
        })
    }

async function setupUser(){
    /* User Creation */
    console.clear()
    console.log('\x1b[36m' + "Time to create your admin user." + '\x1b[0m');
    console.log('Default username is ' + '\x1b[36m' + `${serverSettings.user.username}`+ '\x1b[0m');
    console.log('Default password is ' + '\x1b[36m' + `${serverSettings.user.password}`+ '\x1b[0m');
    console.log('(This can be changed later)');

    let username = readlineSync.question('Choose username: ');
    if (username != "")
        serverSettings.user.username = username;

    let password = readlineSync.question('Choose password: ');
        if (password != "")
            serverSettings.user.password = password;
}

async function createUser(user){

    mongoose.connect(serverSettings.mongoDB, { useNewUrlParser: true }).then(() => {
        let newUser = new User()
        newUser.initialSignup(user.username, null, user.password);

        newUser.save((error, user) => {
            if(error)
                throw new Error(error);
            else 
                mongoose.disconnect();
        });

       
    }).catch(error => {
        throw new Error(error);
    })

}

async function saveSettings(settings){
    fs.appendFile(__dirname +  '/serverSettings.json',JSON.stringify(settings), function (err) {
        if (err) throw err;
    });
}

function finished(){
    console.clear();
    console.log('\x1b[32m' + '======== SERVER SETUP COMPLETE ========' + '\x1b[0m');
    console.log('\x1b[31m' + 'You should write this down aswell' + '\x1b[0m');
    console.log('\x1b[31m' + 'otherwise you can also find this in:' + '\x1b[0m');
    console.log('\x1b[31m' + './bin/server/config/serverSettings.json' + '\x1b[0m');
    console.log('Server name: '     + '\x1b[36m' + serverSettings.serverName    + '\x1b[0m');
    console.log('Server port: '     + '\x1b[36m' + serverSettings.serverPort    + '\x1b[0m');
    console.log('MongoDB Server: '  + '\x1b[36m' + serverSettings.mongoDB       + '\x1b[0m');
    console.log('Website name: '    + '\x1b[36m' + serverSettings.websiteName   + '\x1b[0m');
    console.log('Username: '        + '\x1b[36m' + serverSettings.user.username + '\x1b[0m');
    console.log('Password: '        + '\x1b[36m' + serverSettings.user.password + '\x1b[0m');
    console.log('\x1b[32m' + '=======================================' + '\x1b[0m');
}

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds){
            break;
        }
    }
}