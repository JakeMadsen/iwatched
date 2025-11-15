var mongoose = require('mongoose');

var genreSchema = new mongoose.Schema({
    id: { type: Number },
    name: { type: String }
}, { _id: false });

var personRefSchema = new mongoose.Schema({
    id: { type: Number },
    name: { type: String }
}, { _id: false });

var movieSchema = mongoose.Schema({
    tmd_id: String,
    movie_title: String,
    movie_runtime: Number,
    poster_path: String,
    release_date: String,
    genres: { type: [genreSchema], default: [] },
    credits_actors: { type: [personRefSchema], default: [] },
    credits_directors: { type: [personRefSchema], default: [] }
});

movieSchema.methods.initial = function(movie){
    this.tmd_id = movie.id;
    this.movie_title = movie.title;
    this.movie_runtime = typeof movie.runtime === 'number' ? movie.runtime : Number(movie.runtime) || 0;
    try { this.poster_path = movie.poster_path || this.poster_path || null; } catch(_) {}
    try { this.release_date = movie.release_date || this.release_date || null; } catch(_) {}
    try { this.genres = Array.isArray(movie.genres) ? movie.genres.map(function(g){ return { id: g.id, name: g.name }; }) : this.genres || []; } catch(_) {}
}

module.exports = mongoose.model('Movie', movieSchema, 'movies');
