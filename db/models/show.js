var mongoose = require('mongoose');

var showSchema = mongoose.Schema({
    tmd_id: String,
    show_title: String,
    show_runtime: String,
    poster_path: String
});

showSchema.methods.initial = function(show){
    this.tmd_id = show.id;
    this.show_title = show.name || show.title || '';
    this.show_runtime = (show.episode_run_time && show.episode_run_time[0]) || 0;
    try { this.poster_path = show.poster_path || this.poster_path || null; } catch(_) {}
}

module.exports = mongoose.model('Show', showSchema, 'shows');
