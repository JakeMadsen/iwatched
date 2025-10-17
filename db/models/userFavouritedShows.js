var mongoose = require('mongoose');

var userFavouritedShowsSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shows_favourited: { type: Array, default: [] }
});

userFavouritedShowsSchema.methods.initial = function (user_id) {
    this.user_id = user_id;
}

userFavouritedShowsSchema.methods.addFavouritedShow = function (show_id){
    let show = {
        id: show_id
    }
    this.shows_favourited.push(show);
}

userFavouritedShowsSchema.methods.removeFavouritedShow = function (show_id){
    for(i = 0; i < this.shows_favourited.length; i++) {
        if (this.shows_favourited[i].id  == show_id){
            this.shows_favourited.splice(i, 1);
            break;
        }
    }
}

module.exports = mongoose.model('userFavouritedShows', userFavouritedShowsSchema, 'user_favourited_shows');

