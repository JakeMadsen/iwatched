const User = require('../../db/models/user')
const createError = require('http-errors');

module.exports = {
    getAll: () => {
        return new Promise(function (resolve, reject) {
            User.find({}, function (error, users) {
                if (error) 
                    reject(error, "Fejl i database - hent alle brugere")
                else 
                    resolve(users)
            });
        })
    },
    getOne: (value) => {
        return new Promise((resolve, reject) => {
            User.findOne({$or: [{'_id': value},{'profile.custom_url': value}]},(error, user) => {
                if (error) 
                    createError(503, "Could not find user in database")
                if(!user)
                    resolve(null)
                if(user)
                    resolve(user)
            });
        })
    }
}
