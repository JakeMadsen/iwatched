var mongoose = require('mongoose');

var userMovieTotalsSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    unique_movies_watched: { type: Number, default: 0 },
    total_movies_watched: { type: Number, default: 0 },
    total_runtime: { type: Number, default: 0 } // minutes
});

userMovieTotalsSchema.methods.initial = function (user_id) {
    this.user_id = user_id;
}

userMovieTotalsSchema.methods.incWatch = function (isFirstForMovie, runtime) {
    this.total_movies_watched = (this.total_movies_watched || 0) + 1;
    if (isFirstForMovie) this.unique_movies_watched = (this.unique_movies_watched || 0) + 1;
    if (runtime && !isNaN(runtime)) this.total_runtime = (this.total_runtime || 0) + Number(runtime);
}

userMovieTotalsSchema.methods.decWatch = function (isLastForMovie, runtime) {
    if ((this.total_movies_watched || 0) > 0) this.total_movies_watched -= 1;
    if (isLastForMovie && (this.unique_movies_watched || 0) > 0) this.unique_movies_watched -= 1;
    if (runtime && !isNaN(runtime)) this.total_runtime = Math.max(0, (this.total_runtime || 0) - Number(runtime));
}

module.exports = mongoose.model('UserMovieTotals', userMovieTotalsSchema, 'user_movie_totals');

