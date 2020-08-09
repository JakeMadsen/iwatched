var mongoose = require('mongoose');

var userSavedMoviesSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    movies_saved: { type: Array, default: [] }
});

userSavedMoviesSchema.methods.initial = function (user_id) {
    this.user_id = user_id;
}

userSavedMoviesSchema.methods.addSavedMovie = function (movie_id){
    let movie = {
        id: movie_id,
    }

    this.movies_saved.push(movie);
}

userSavedMoviesSchema.methods.removeSavedMovie = function (movie_id){
    for(i = 0; i < this.movies_saved.length; i++) {
        if (this.movies_saved[i].id  == movie_id){
            this.movies_saved.splice(i, 1);
            break;
        }
    }
}

module.exports = mongoose.model('userSavedMoviesSchema', userSavedMoviesSchema, 'user_saved_movies');