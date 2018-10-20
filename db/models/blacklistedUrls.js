var blacklistSchema = mongoose.Schema({
    url_name: String,
    owner_id: String
});
module.exports = mongoose.model('Blacklist', blacklistSchema, 'blacklisted_urls');