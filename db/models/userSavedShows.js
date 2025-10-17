var mongoose = require('mongoose');

var userSavedShowsSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shows_saved: { type: Array, default: [] }
});

userSavedShowsSchema.methods.initial = function (user_id) {
    this.user_id = user_id;
}

userSavedShowsSchema.methods.addSavedShow = function (show_id){
    let show = {
        id: show_id,
    }
    this.shows_saved.push(show);
}

userSavedShowsSchema.methods.removeSavedShow = function (show_id){
    for(i = 0; i < this.shows_saved.length; i++) {
        if (this.shows_saved[i].id  == show_id){
            this.shows_saved.splice(i, 1);
            break;
        }
    }
}

module.exports = mongoose.model('userSavedShows', userSavedShowsSchema, 'user_saved_shows');

