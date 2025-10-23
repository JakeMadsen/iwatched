var mongoose = require('mongoose');

var seasonSchema = new mongoose.Schema({
    season_number: { type: Number },
    watched_count: { type: Number, default: 0 },
    date_completed: { type: Date, default: null }
}, { _id: false });

var userShowSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    show_id: { type: String, index: true },
    show_watched: { type: Date, default: null },
    show_watched_count: { type: Number, default: 0 },
    show_bookmarked: { type: Date, default: null },
    show_favorite: { type: Date, default: null },
    personal_note: { type: String, default: "" },
    personal_rating: { type: Number, default: 0 },
    date_updated: { type: Date, default: Date.now },

    seasons: { type: [seasonSchema], default: [] }
});

userShowSchema.index({ user_id: 1, show_id: 1 }, { unique: true });

userShowSchema.methods.initial = function (user_id, show_id) {
    this.user_id = user_id;
    this.show_id = String(show_id);
    this.date_updated = new Date();
}

userShowSchema.methods.markEpisodeWatched = function (seasonNumber) {
    this.show_watched_count = (this.show_watched_count || 0) + 1;
    this.show_watched = new Date();
    if (seasonNumber !== undefined && seasonNumber !== null) {
        const sn = Number(seasonNumber);
        let s = (this.seasons || []).find(x => Number(x.season_number) === sn);
        if (!s) {
            s = { season_number: sn, watched_count: 0, date_completed: null };
            this.seasons.push(s);
        }
        s.watched_count = (s.watched_count || 0) + 1;
        try { this.markModified && this.markModified('seasons'); } catch (_) {}
    }
    this.date_updated = new Date();
}

userShowSchema.methods.unwatchEpisode = function (seasonNumber) {
    if ((this.show_watched_count || 0) > 0) this.show_watched_count -= 1;
    if ((this.show_watched_count || 0) === 0) this.show_watched = null;
    if (seasonNumber !== undefined && seasonNumber !== null) {
        const sn = Number(seasonNumber);
        let s = (this.seasons || []).find(x => Number(x.season_number) === sn);
        if (s && (s.watched_count || 0) > 0) s.watched_count -= 1;
        if (s && (s.watched_count || 0) === 0) s.date_completed = null;
        try { this.markModified && this.markModified('seasons'); } catch (_) {}
    }
    this.date_updated = new Date();
}

userShowSchema.methods.setSeasonCompleted = function (seasonNumber, completed) {
    const sn = Number(seasonNumber);
    let s = (this.seasons || []).find(x => Number(x.season_number) === sn);
    if (!s) { s = { season_number: sn, watched_count: 0, date_completed: null }; this.seasons.push(s); }
    s.date_completed = completed ? new Date() : null;
    try { this.markModified && this.markModified('seasons'); } catch (_) {}
    this.date_updated = new Date();
}

userShowSchema.methods.setBookmarked = function (enabled) {
    this.show_bookmarked = enabled ? new Date() : null;
    this.date_updated = new Date();
}

userShowSchema.methods.setFavourited = function (enabled) {
    this.show_favorite = enabled ? new Date() : null;
    this.date_updated = new Date();
}

userShowSchema.methods.setNote = function (text) {
    this.personal_note = text || "";
    this.date_updated = new Date();
}

userShowSchema.methods.setRating = function (rating) {
    this.personal_rating = Number(rating) || 0;
    this.date_updated = new Date();
}

module.exports = mongoose.model('UserShow', userShowSchema, 'user_shows');
