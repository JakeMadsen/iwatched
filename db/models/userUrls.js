var mongoose = require('mongoose');

var userUrlSchema = mongoose.Schema({
    user_id:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    custom_url:         { type: String, default: null, index: { unique : true} },
    creation_date:      { type: Date, default: Date.now }
});

userUrlSchema.methods.initial = function(user_id, custom_url){
    this.user_id = user_id;
    this.custom_url = custom_url;
}

module.exports = mongoose.model('UserUrl', userUrlSchema, 'user_urls');