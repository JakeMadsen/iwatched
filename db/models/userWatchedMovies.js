var mongoose = require('mongoose');

var userWatchedMoviesSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    movie_watch_time:   { type: Number, default: 0 },
    movies_watched: { type: Array, default: [] }
});

userWatchedMoviesSchema.methods.initial = function (user_id) {
    this.user_id = user_id;
}


userWatchedMoviesSchema.methods.addMovieRuntime = function (time){
    let totalMovieTime = +this.movie_watch_time + +time;
    this.movie_watch_time = totalMovieTime;
}

userWatchedMoviesSchema.methods.addMovieWatched = function (movie_id){
    let movie = {
        id: movie_id,
        times_watched: 1
    }

    this.movies_watched.push(movie);
}

userWatchedMoviesSchema.methods.removeMovieRuntime = function (time) {
    let totalMovieTime = this.movie_watch_time - time;
    this.movie_watch_time = totalMovieTime;
}


userWatchedMoviesSchema.methods.removeMovieWatched = function (movie_id){
    for(i = 0; i < this.movies_watched.length; i++) {
        if (this.movies_watched[i].id  == movie_id){
            this.movies_watched.splice(i, 1);
            break;
        }
    }
}

module.exports = mongoose.model('userWatchedMovies', userWatchedMoviesSchema, 'user_watched_movies');