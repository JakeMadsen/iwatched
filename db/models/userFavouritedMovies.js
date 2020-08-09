var mongoose = require('mongoose');

var userFavouritedMovieSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    movies_favourited: { type: Array, default: [] }
});

userFavouritedMovieSchema.methods.initial = function (user_id) {
    this.user_id = user_id;
}

userFavouritedMovieSchema.methods.addFavouritedMovie = function (movie_id){
    let movie = {
        id: movie_id
    }

    this.movies_favourited.push(movie);
}

userFavouritedMovieSchema.methods.removeFavouritedMovie = function (movie_id){
    for(i = 0; i < this.movies_favourited.length; i++) {
        if (this.movies_favourited[i].id  == movie_id){
            this.movies_favourited.splice(i, 1);
            break;
        }
    }
}

module.exports = mongoose.model('userFavouritedMovies', userFavouritedMovieSchema, 'user_favourited_movies');