const User = require('../../db/models/user')

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
        return new Promise(function (resolve, reject) {
            User.findOne({ '_id': value },(error, user) => {
                if (error) 
                    reject(error, "Fejl i database - hent 1 bruger")
                else 
                    resolve(user)
            });
        })
    },
    saveUser: async (id, content, files) => {
        return new Promise(function (resolve, reject) {
            let image = files.image_file;
            User
            .findById(id)
            .exec((error, user) => {
                if (!image) {
                    user.update(content)
                    user.save((error, userUpdated) => {
                        if(error)
                            reject({ error: error, custom_message: "Fejl i at gemme skolen. Prøv igen" })
                        else
                            resolve(userUpdated)
                    });
                } else {
                    image.mv(`public/style/img/editors/${image.name}`, (error) => {
                        if (error) {
                            reject({ error: error, custom_message: "Fejl i at gemme skolen. Prøv igen" })
                        }
                        else {
                            user.update(data, image.name)
                            user.save((error, userUpdated) => {
                                if(error)
                                    reject({ error: error, custom_message: "Fejl i at gemme skolen. Prøv igen" })
                                else
                                    resolve(userUpdated)
                            });
                        }
                    });
                }
            })
        })
    },
    newUser: async (data, files) => {
        return new Promise(function (resolve, reject) {
            let image = files.image_file;

            let newUser = new User()
                if (!image) {
                    newUser.update(content)
                    newUser.save((error, userUpdated) => {
                        if(error)
                            reject({ error: error, custom_message: "Fejl i at gemme skolen. Prøv igen" })
                        else
                            resolve(userUpdated)
                    });
                } else {
                    image.mv(`public/style/img/editors/${image.name}`, (error) => {
                        if (error) {
                            reject({ error: error, custom_message: "Fejl i at gemme skolen. Prøv igen" })
                        }
                        else {
                            newUser.update(data, image.name)
                            newUser.save((error, userUpdated) => {
                                if(error)
                                    reject({ error: error, custom_message: "Fejl i at gemme skolen. Prøv igen" })
                                else
                                    resolve(userUpdated)
                            });
                        }
                    });
                }
            
        })
    }
}
function getOneUser(value) {
    return new Promise(function (resolve, reject) {
        User.findOne({ $or: [{ 'name': value }, { 'adress.city': value }] }, function (err, User) {
            if (err)
                return reject(err)

            else
                return resolve(User)
        });
    })
}
