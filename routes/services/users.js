const User = require('../../db/models/user')
const createError = require('http-errors');
const fs = require('fs')

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
    },
    saveUser: async (id, content, files) => {
        return new Promise((resolve, reject) => {
            var newProfilePicture = files.profilePictureFile;
            var newProfileBanner = files.profileBannerFile;

            console.log(newProfileBanner)

            User
            .findById(id)
            .exec((error, user) => {
                var imagePB = null;
                var imageBA = null;

                if (error)
                    throw new Error({error: error, custom_error: "Something went wrong with saving settings"})

                if(JSON.stringify(files) == "{}"){
                    user.updateSettings(content)
                }else {
                    if(newProfilePicture){
                        saveProfileImages(user._id, newProfilePicture, user.profile.profile_image)
                        imagePB = newProfilePicture.name
                    }
                        
                    if(newProfileBanner){
                        saveProfileImages(user._id, newProfileBanner, user.profile.banner_image)
                        imageBA = newProfileBanner.name
                    }
                    console.log("pb: " + imagePB, "     ba: "+ imageBA)
                    user.updateSettings(content, imagePB, imageBA)
                }

                user.save((error, userUpdated) => {
                    if(error)
                        throw new Error({error: error, custom_error: "Something went wrong with saving settings"})
                
                    else
                        resolve(userUpdated)
                });
                
            })
        })
    }
}

function saveProfileImages(user_id, new_image, old_image){
    fs.unlink(`public/style/img/profile_images/users/${user_id}/${old_image}`, (err) => {
        new_image.mv(`public/style/img/profile_images/users/${user_id}/${new_image.name}`, (error) => {
            if (error)
                throw new Error({error: error, custom_error: "Something went wrong with saving image"})
        });
    });
}