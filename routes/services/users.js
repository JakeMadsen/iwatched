/*
*   Mongoose models
**************************/
const User                  = require('../../db/models/user');
const UserWatchedMovies     = require('../../db/models/userWatchedMovies');
const UserFavouritedMovies  = require('../../db/models/userFavouritedMovies');
const UserSavedMovies       = require('../../db/models/userSavedMovies');
const UserWatchedShows      = require('../../db/models/userWatchedShows');

/*
*   Services
**************************/
const fs        = require('fs');
const mongoose  = require('mongoose');


/*
*   Exported functions
**************************/
module.exports = {
    getAll: () => {
        return new Promise(function (resolve, reject) {
            User.find({}, function (error, users) {
                if (error)
                    reject(error, "Could not get users")
                else
                    resolve(users)
            });
        })
    },
    getOne: (user_id) => {
        return new Promise((resolve, reject) => {
            if(mongoose.Types.ObjectId.isValid(user_id) === true){
                User.findOne({ '_id': user_id }, (error, user) => {
                    if (error)
                        reject(error)
                    if (!user)
                        resolve(null)
                    if (user)
                        resolve(user)
                });
            }
            else {
                User.findOne({ 'profile.custom_url': user_id }, (error, user) => {
                    if (error)
                        reject(error)
                    if (!user)
                        resolve(null)
                    if (user)
                        resolve(user)
                });
            }
        })
    },
    saveUser: async (id, content, files) => {
        return new Promise((resolve, reject) => {
            var newProfilePicture   = null;
            var newProfileBanner    = null;

            if (files) {
                newProfilePicture   = files.profilePictureFile
                newProfileBanner   = files.profileBannerFile
            }

            User
                .findById(id)
                .exec(async (error, user) => {
                    var imagePB = null;
                    var imageBA = null;

                    try {

                        if (error)
                            reject({ error: error, custom_error: "Something went wrong with saving settings" })

                        if (JSON.stringify(files) == "{}" || files == null){
                            await user.updateSettings(content)
                        }
                            
                        else 
                        {
                            if (newProfilePicture) {
                                saveProfileImages(user._id, newProfilePicture, user.profile.profile_image, "picture");
                                let newName = `picture_${user._id}.${getFileExtention(newProfilePicture.name)}`;
                                imagePB = newName;
                            }

                            if (newProfileBanner) {
                                saveProfileImages(user._id, newProfileBanner, user.profile.banner_image, "banner");
                                let newName = `banner_${user._id}.${getFileExtention(newProfileBanner.name)}`;
                                imageBA = newName
                            }
                            await user.updateSettings(content, imagePB, imageBA)
                        }

                        user.save((error, userUpdated) => {
                            if (error)
                                reject({ error: error, custom_error: "Something went wrong with saving settings" })

                            else
                                resolve(userUpdated)
                        });
                        
                    } catch (error) {
                        console.log("Update user catch error:", error)
                    }

                    

                })
        })
    },
    checkIfUserWatchedMovie: async(user_id, movie_id) => {
        return new Promise((resolve, reject) => {
            UserWatchedMovies.findOne({ 'user_id': user_id }, (error, watchedMovies) => {
                let check = false;

                if(error)
                    reject(error)

                if(!watchedMovies) {
                    let newEntry = new UserWatchedMovies()
                        newEntry.initial(user_id)
                        newEntry.save();

                    resolve(false)
                }
                
                else
                {
                    watchedMovies.movies_watched.forEach(movie => {
                        if( movie.id == movie_id)
                            check = true;
                    });
                    resolve(check)
                }
            })
        })
    },
    checkIfUserFavouritedMovie: async(user_id, movie_id) => {
        return new Promise((resolve, reject) => {
            UserFavouritedMovies.findOne({ 'user_id': user_id }, (error, favouritedMovies) => {
                let check = false;

                if(error)
                    reject(error)

                if(!favouritedMovies) {
                    let newEntry = new UserFavouritedMovies()
                        newEntry.initial(user_id)
                        newEntry.save();

                    resolve(false)
                }
                
                else
                {
                    favouritedMovies.movies_favourited.forEach(movie => {
                        if( movie.id == movie_id)
                            check = true;
                    });
                    resolve(check)
                }
            })
        })
    },
    checkIfUserSavedMovie: async(user_id, movie_id) => {
        return new Promise((resolve, reject) => {
            UserSavedMovies.findOne({ 'user_id': user_id }, (error, savedMovies) => {
                let check = false;

                if(error)
                    reject(error)

                if(!savedMovies) {
                    let newEntry = new UserSavedMovies()
                        newEntry.initial(user_id)
                        newEntry.save();

                    resolve(false)
                }
                
                else
                {
                    savedMovies.movies_saved.forEach(movie => {
                        if( movie.id == movie_id)
                            check = true;
                    });
                    resolve(check)
                }
            })
        })
    },
    getWatchedMovies: async(user_id) => {
        return new Promise((resolve, reject) => {
            UserWatchedMovies.findOne({ 'user_id': user_id }, (error, watchedMovies) => {
                if(error)
                    reject(error)
                if(watchedMovies)
                    resolve(watchedMovies)
            })
        })
    },
    getFavouritedMovies: async(user_id) => {
        return new Promise((resolve, reject) => {
            UserFavouritedMovies.findOne({ 'user_id': user_id }, (error, favouritedMovies) => {
                if(error)
                    reject(error)
                if(favouritedMovies)
                    resolve(favouritedMovies)
            })
        })
    },
    getSavedMovies: async(user_id) => {
        return new Promise((resolve, reject) => {
            UserSavedMovies.findOne({ 'user_id': user_id }, (error, savedMovies) => {
                if(error)
                    reject(error)
                if(savedMovies)
                    resolve(savedMovies)
            })
        })
    },
    getTimeWatched: async(user_id, type) => {
        return new Promise((resolve, reject) => {
            if(type == "movies"){
                UserWatchedMovies.findOne({ 'user_id': user_id }, (error, watchedMovies) => {
                    if(error)
                        reject(error)
                    if(watchedMovies){
                        let totalTime = getTimeWatched(watchedMovies.movie_watch_time)
                        resolve(totalTime)
                    }
                        
                })
            }
            else if (type == "shows"){
                UserWatchedShows.findOne({ 'user_id': user_id }, (error, watchedShows) => {
                    if(error)
                        reject(error)
                    if(watchedShows){
                        let totalTime = getTimeWatched(watchedShows.show_watch_time)
                        resolve(totalTime)
                    }
                })
            }
            
        })
        
    }
}

/*
*   Local functions
**************************/
function saveProfileImages(user_id, new_image, old_image, type) {
    const dir = `public/style/img/profile_images/users/${user_id}`;

    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // remove old image if provided and exists
        if (old_image && fs.existsSync(`${dir}/${old_image}`)) {
            try { fs.unlinkSync(`${dir}/${old_image}`); } catch (_) {}
        }
        if (!new_image) return;
        new_image.name = `${type}_${user_id}.${getFileExtention(new_image.name || '')}`;
        // express-fileupload provides mv
        if (typeof new_image.mv === 'function') {
            new_image.mv(`${dir}/${new_image.name}`, (error) => {
                if (error) console.error('save image : error', error);
            });
        }
    } catch (e) {
        console.error('saveProfileImages failure:', e);
    }
}

function getFileExtention(filename) {
    var a = filename.split(".");
    if( a.length === 1 || ( a[0] === "" && a.length === 2 ) ) {
        return "";
    }
    return a.pop().toLowerCase();    // feel free to tack .toLowerCase() here if you want
}

function getTimeWatched(runtime) {
    var days = Math.floor(runtime / 1440);
    var hours = Math.floor((runtime - (days * 1440)) / 60);
    var minutes = Math.round(runtime % 60);
    var text = "hour"
    var text2 = "day"

    if (hours > 1 || hours == 0)
        text = "hours"
    if (days > 1 || days == 0)
        text2 = "days"

    return (`${days} ${text2} and ${hours} ${text} and ${minutes} minutes`);
}


