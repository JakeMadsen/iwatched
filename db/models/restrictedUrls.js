var mongoose = require('mongoose');

var restrictedUrlSchema = mongoose.Schema({
    created_by:             { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    info :                  { type : String, default: null },
    restricted_url:         { type: String, default: null, index: { unique : true} },
    creation_date:          { type: Date, default: Date.now }
});

restrictedUrlSchema.methods.initial = function(user_id, url, info){
    this.created_by = user_id;
    this.restricted_url = url;
    this.info = info
}

module.exports = mongoose.model('RestrictedUrl', restrictedUrlSchema, 'restricted_urls');