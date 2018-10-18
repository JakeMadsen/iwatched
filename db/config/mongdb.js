var mongoose = require('mongoose');

module.exports = {
    "connect": () => {
        mongoose.connect('mongodb+srv://JakeTheDane:Acq59hhc.@maincluster-r0dde.mongodb.net/svendeproeve', {useNewUrlParser: true})
        let connection = mongoose.connection
        return connection;
    }
}