var mongoose = require('mongoose');

module.exports = {
    "connect": () => {
        mongoose.connect('mongodb://localhost:27017/iWatched')
        let db = mongoose.connection
        return db;
    }
}


// config/database.js
// module.exports = {

//     'url' : 'your-settings-here' // looks like mongodb://<user>:<pass>@mongo.onmodulus.net:27017/Mikha4ot

// };