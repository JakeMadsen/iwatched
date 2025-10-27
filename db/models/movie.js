var mongoose = require('mongoose');

var movieSchema = mongoose.Schema({
    tmd_id: String,
    movie_title: String,
    movie_runtime: String,
    poster_path: String
});

movieSchema.methods.initial = function(movie){
    this.tmd_id = movie.id;
    this.movie_title = movie.title;
    this.movie_runtime = movie.runtime;
    try { this.poster_path = movie.poster_path || this.poster_path || null; } catch(_) {}
}

module.exports = mongoose.model('Movie', movieSchema, 'movies');
