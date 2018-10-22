var mongoose = require('mongoose');

var movieSchema = mongoose.Schema({
    title: String,
    tmd_id: String,
    backdrop_path: String
});

movieSchema.methods.initial = function(movie){
    this.title = movie.title;
    this.tmd_id = movie.id;
    this.backdrop_path = movie.backdrop_path
}

module.exports = mongoose.model('Movie', movieSchema, 'movies');