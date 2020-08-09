var mongoose = require('mongoose');

var movieSchema = mongoose.Schema({
    tmd_id: String,
    movie_title: String,
    movie_runtime: String
});

movieSchema.methods.initial = function(movie){
    this.tmd_id = movie.id;
    this.movie_title = movie.title;
    this.movie_runtime = movie.runtime;
}

module.exports = mongoose.model('Movie', movieSchema, 'movies');