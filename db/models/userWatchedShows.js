var mongoose = require('mongoose');

var userWatchedShowsSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    show_watch_time:   { type: Number, default: 0 },
    shows_watched: { type: Array, default: [] }
});

userWatchedShowsSchema.methods.initial = function (user_id) {
    this.user_id = user_id;
}

userWatchedShowsSchema.methods.addShowRuntime = function (time){
    let totalTime = +this.show_watch_time + +time;
    this.show_watch_time = totalTime;
}

userWatchedShowsSchema.methods.addShowWatched = function (show_id){
    let show = {
        id: show_id,
        times_watched: 1
    }
    this.shows_watched.push(show);
}

userWatchedShowsSchema.methods.removeShowRuntime = function (time) {
    let totalTime = this.show_watch_time - time;
    this.show_watch_time = totalTime;
}

userWatchedShowsSchema.methods.removeShowWatched = function (show_id){
    for(i = 0; i < this.shows_watched.length; i++) {
        if (this.shows_watched[i].id  == show_id){
            this.shows_watched.splice(i, 1);
            break;
        }
    }
}

module.exports = mongoose.model('userWatchedShows', userWatchedShowsSchema, 'user_watched_shows');

