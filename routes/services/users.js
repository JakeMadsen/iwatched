/*
*   Mongoose models
**************************/
const User                  = require('../../db/models/user');
const UserMovie             = require('../../db/models/userMovie');
const UserMovieTotals       = require('../../db/models/userMovieTotals');
const UserShowTotals        = require('../../db/models/userShowTotals');

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
            const id = String(user_id || '');
            if (mongoose.Types.ObjectId.isValid(id) === true){
                User.findOne({ '_id': id }, (error, user) => {
                    if (error) return reject(error);
                    if (user) return resolve(user);
                    return resolve(null);
                });
            } else {
                // Try exact match first
                User.findOne({ 'profile.custom_url': id }, (error, user) => {
                    if (error) return reject(error);
                    if (user) return resolve(user);
                    // Fallback: case-insensitive match for legacy/casual links
                    try {
                        const rx = new RegExp('^' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
                        User.findOne({ 'profile.custom_url': rx }, (e2, u2) => {
                            if (e2) return reject(e2);
                            return resolve(u2 || null);
                        });
                    } catch (e) {
                        return resolve(null);
                    }
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
        try {
            const doc = await UserMovie.findOne({ user_id: user_id, movie_id: String(movie_id) }).lean();
            return !!(doc && (((doc.movie_watched_count||0) > 0) || !!doc.movie_watched));
        } catch (_) { return false; }
    },
    checkIfUserFavouritedMovie: async(user_id, movie_id) => {
        try { const doc = await UserMovie.findOne({ user_id: user_id, movie_id: String(movie_id) }).lean(); return !!(doc && !!doc.movie_favorite); } catch (_) { return false; }
    },
    checkIfUserSavedMovie: async(user_id, movie_id) => {
        try { const doc = await UserMovie.findOne({ user_id: user_id, movie_id: String(movie_id) }).lean(); return !!(doc && !!doc.movie_bookmarked); } catch (_) { return false; }
    },
    getWatchedMovies: async(user_id) => {
        try {
            const count = await UserMovie.countDocuments({ user_id: user_id, movie_watched_count: { $gt: 0 } });
            return { user_id: user_id, movies_watched: Array.from({ length: count }).map(()=>({ id: null })) };
        } catch (_) { return { user_id: user_id, movies_watched: [] }; }
    },
    getFavouritedMovies: async(user_id) => {
        try { const ids = await UserMovie.find({ user_id: user_id, movie_favorite: { $ne: null } }).select('movie_id').lean(); return { user_id: user_id, movies_favourited: ids.map(d=>({ id: d.movie_id })) }; } catch (_) { return { user_id: user_id, movies_favourited: [] }; }
    },
    getSavedMovies: async(user_id) => {
        try { const ids = await UserMovie.find({ user_id: user_id, movie_bookmarked: { $ne: null } }).select('movie_id').lean(); return { user_id: user_id, movies_saved: ids.map(d=>({ id: d.movie_id })) }; } catch (_) { return { user_id: user_id, movies_saved: [] }; }
    },
    getTimeWatched: async(user_id, type) => {
        return new Promise((resolve, reject) => {
            function asText(mins){
                try { return getTimeWatched(Number(mins)||0); } catch(_) { return getTimeWatched(0); }
            }
            if(type == "movies"){
                UserWatchedMovies.findOne({ 'user_id': user_id }, (error, watchedMovies) => {
                    if(error) return reject(error);
                    if(watchedMovies) return resolve(asText(watchedMovies.movie_watch_time));
                    // No doc yet → zero time
                    return resolve(asText(0));
                })
            }
            else if (type == "shows"){
                UserWatchedShows.findOne({ 'user_id': user_id }, (error, watchedShows) => {
                    if(error) return reject(error);
                    if(watchedShows) return resolve(asText(watchedShows.show_watch_time));
                    return resolve(asText(0));
                })
            } else {
                return resolve(asText(0));
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


