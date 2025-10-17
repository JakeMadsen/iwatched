var mongoose = require('mongoose');

var showSchema = mongoose.Schema({
    tmd_id: String,
    show_title: String,
    show_runtime: String
});

showSchema.methods.initial = function(show){
    this.tmd_id = show.id;
    this.show_title = show.name || show.title || '';
    this.show_runtime = (show.episode_run_time && show.episode_run_time[0]) || 0;
}

module.exports = mongoose.model('Show', showSchema, 'shows');

