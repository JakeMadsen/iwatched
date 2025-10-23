var mongoose = require('mongoose');

var userShowTotalsSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    unique_shows_watched: { type: Number, default: 0 },
    // Number of seasons completed (date_completed set), across all shows
    total_seasons_watched: { type: Number, default: 0 },
    total_episodes_watched: { type: Number, default: 0 },
    total_runtime: { type: Number, default: 0 } // minutes
});

userShowTotalsSchema.methods.initial = function (user_id) {
    this.user_id = user_id;
}

userShowTotalsSchema.methods.incEpisode = function (isFirstForShow, runtime) {
    this.total_episodes_watched = (this.total_episodes_watched || 0) + 1;
    if (isFirstForShow) this.unique_shows_watched = (this.unique_shows_watched || 0) + 1;
    if (runtime && !isNaN(runtime)) this.total_runtime = (this.total_runtime || 0) + Number(runtime);
}

userShowTotalsSchema.methods.decEpisode = function (isLastForShow, runtime) {
    if ((this.total_episodes_watched || 0) > 0) this.total_episodes_watched -= 1;
    if (isLastForShow && (this.unique_shows_watched || 0) > 0) this.unique_shows_watched -= 1;
    if (runtime && !isNaN(runtime)) this.total_runtime = Math.max(0, (this.total_runtime || 0) - Number(runtime));
}

module.exports = mongoose.model('UserShowTotals', userShowTotalsSchema, 'user_show_totals');
