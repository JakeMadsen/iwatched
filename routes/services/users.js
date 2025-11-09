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
const path      = require('path');
const mongoose  = require('mongoose');
let storage = null;
try { storage = require('../../bin/server/config/storage'); } catch (_) { storage = null; }
let imgProc = null;
try { imgProc = require('../../bin/server/utils/imageProcessing'); } catch (_) { imgProc = null; }


/*
*   Exported functions
**************************/
module.exports = {
    getAll: async () => {
        return await User.find({}).lean();
    },
    getOne: async (user_id) => {
        const id = String(user_id || '');
        if (mongoose.Types.ObjectId.isValid(id)){
            const u = await User.findById(id).lean();
            return u || null;
        }
        const exact = await User.findOne({ 'profile.custom_url': id }).lean();
        if (exact) return exact;
        try {
            const rx = new RegExp('^' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
            const ci = await User.findOne({ 'profile.custom_url': rx }).lean();
            return ci || null;
        } catch (_) {
            return null;
        }
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
                            return reject({ error: error, custom_error: "Something went wrong with saving settings" })

                        if (!user)
                            return reject({ error: new Error('User not found'), custom_error: "Something went wrong with saving settings" })

                        if (JSON.stringify(files) == "{}" || files == null){
                            await user.updateSettings(content)
                        }
                        else {
                            if (newProfilePicture) {
                                await saveProfileImages(user._id, newProfilePicture, (user.profile && user.profile.profile_image) || null, "picture");
                                let newName = `picture_${user._id}.${getFileExtention(newProfilePicture.name)}`;
                                imagePB = newName;
                            }

                            if (newProfileBanner) {
                                await saveProfileImages(user._id, newProfileBanner, (user.profile && user.profile.banner_image) || null, "banner");
                                let newName = `banner_${user._id}.${getFileExtention(newProfileBanner.name)}`;
                                imageBA = newName
                            }
                            await user.updateSettings(content, imagePB, imageBA)
                        }

                        user.save((error, userUpdated) => {
                            if (error)
                                return reject({ error: error, custom_error: "Something went wrong with saving settings" })
                            return resolve(userUpdated)
                        });

                    } catch (error) {
                        console.log("Update user catch error:", error)
                        return reject({ error: error, custom_error: (error && error.message) || 'Failed to process image', code: error && (error.code || null) })
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
                UserMovieTotals.findOne({ 'user_id': user_id }, (error, totals) => {
                    if(error) return reject(error);
                    const mins = (totals && typeof totals.total_runtime === 'number') ? totals.total_runtime : 0;
                    return resolve(asText(mins));
                    // No doc yet → zero time
                    return resolve(asText(0));
                })
            }
            else if (type == "shows"){
                UserShowTotals.findOne({ 'user_id': user_id }, (error, totals) => {
                    if(error) return reject(error);
                    const mins = (totals && typeof totals.total_runtime === 'number') ? totals.total_runtime : 0;
                    return resolve(asText(mins));
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
async function saveProfileImages(user_id, new_image, old_image, type) {
    if (!new_image) return;
    try {
        if (!imgProc || typeof imgProc.processProfileImage !== 'function') {
            throw Object.assign(new Error('Image processor missing'), { code: 'processor_missing' });
        }
        // Pull data buffer
        const raw = (new_image.data && Buffer.isBuffer(new_image.data)) ? new_image.data
                   : (new_image.tempFilePath ? fs.readFileSync(new_image.tempFilePath) : null);
        if (!raw) throw Object.assign(new Error('No file data available for upload'), { code: 'no_data' });

        // Validate + compress
        const processed = await imgProc.processProfileImage(raw, type);
        const filename = `${type}_${user_id}.${processed.ext}`;
        const relKey = `style/img/profile_images/users/${user_id}/${filename}`;

        const useS3 = !!(storage && storage.isEnabled && storage.isEnabled());
        if (useS3) {
            if (old_image) { try { await storage.deleteObject(`style/img/profile_images/users/${user_id}/${old_image}`); } catch (_) {} }
            await storage.putObject(relKey, processed.buffer, processed.contentType);
            new_image.name = filename; // so caller saves it in mongo
            return;
        }

        // FS fallback
        const base = path.join(__dirname, '../../public');
        const dir = path.join(base, 'style', 'img', 'profile_images', 'users', String(user_id));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (old_image && fs.existsSync(path.join(dir, old_image))) { try { fs.unlinkSync(path.join(dir, old_image)); } catch (_) {} }
        fs.writeFileSync(path.join(dir, filename), processed.buffer);
        new_image.name = filename;
    } catch (e) {
        console.error('saveProfileImages failure:', e);
        throw e;
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






