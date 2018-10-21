var mongoose = require('mongoose');

var blacklistSchema = mongoose.Schema({
    url_name: String,
    owner_id: String, 
    owner_type: String
});

blacklistSchema.methods.initial = function(url_name, owner_id, owner_type){
    this.url_name = url_name;
    this.owner_id = owner_id;
    this.owner_type = owner_type;
}

module.exports = mongoose.model('Blacklist', blacklistSchema, 'blacklisted_urls');