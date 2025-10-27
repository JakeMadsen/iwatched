var mongoose = require('mongoose');

var showSchema = mongoose.Schema({
    tmd_id: String,
    show_title: String,
    show_runtime: String,
    poster_path: String,
    genres: { type: [Number], default: [] },
    type: { type: String, default: null },
    keywords: { type: [String], default: [] }
});

showSchema.methods.initial = function(show){
    this.tmd_id = show.id;
    this.show_title = show.name || show.title || '';
    this.show_runtime = (show.episode_run_time && show.episode_run_time[0]) || 0;
    try { this.poster_path = show.poster_path || this.poster_path || null; } catch(_) {}
    try { if (Array.isArray(show.genres)) { this.genres = show.genres.map(g=>g && g.id).filter(Boolean); } } catch(_) {}
    try { if (show.type) { this.type = show.type; } } catch(_) {}
}

module.exports = mongoose.model('Show', showSchema, 'shows');
