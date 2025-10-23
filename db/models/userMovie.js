var mongoose = require('mongoose');

var userMovieSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    movie_id: { type: String, index: true },
    movie_runtime: { type: Number, default: 0 },
    movie_watched: { type: Date, default: null },
    movie_watched_count: { type: Number, default: 0 },
    movie_bookmarked: { type: Date, default: null },
    movie_favorite: { type: Date, default: null },
    personal_note: { type: String, default: "" },
    personal_rating: { type: Number, default: 0 },
    date_updated: { type: Date, default: Date.now }
});

// Ensure one entry per user+movie
userMovieSchema.index({ user_id: 1, movie_id: 1 }, { unique: true });

userMovieSchema.methods.initial = function (user_id, movie_id) {
    this.user_id = user_id;
    this.movie_id = String(movie_id);
    this.date_updated = new Date();
}

userMovieSchema.methods.markWatched = function (runtime) {
    this.movie_watched_count = (this.movie_watched_count || 0) + 1;
    this.movie_watched = new Date();
    if (runtime && !isNaN(runtime)) {
        // only set if absent or zero
        if (!this.movie_runtime || this.movie_runtime === 0) this.movie_runtime = Number(runtime);
    }
    this.date_updated = new Date();
}

userMovieSchema.methods.unwatchOnce = function (runtime) {
    if ((this.movie_watched_count || 0) > 0) this.movie_watched_count -= 1;
    if ((this.movie_watched_count || 0) === 0) this.movie_watched = null;
    if (runtime && !isNaN(runtime) && this.movie_runtime === 0) this.movie_runtime = Number(runtime);
    this.date_updated = new Date();
}

userMovieSchema.methods.setBookmarked = function (enabled) {
    this.movie_bookmarked = enabled ? new Date() : null;
    this.date_updated = new Date();
}

userMovieSchema.methods.setFavourited = function (enabled) {
    this.movie_favorite = enabled ? new Date() : null;
    this.date_updated = new Date();
}

userMovieSchema.methods.setNote = function (text) {
    this.personal_note = text || "";
    this.date_updated = new Date();
}

userMovieSchema.methods.setRating = function (rating) {
    this.personal_rating = Number(rating) || 0;
    this.date_updated = new Date();
}

module.exports = mongoose.model('UserMovie', userMovieSchema, 'user_movies');

