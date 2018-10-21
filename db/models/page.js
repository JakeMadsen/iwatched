var mongoose = require('mongoose');

var pageSchema = mongoose.Schema({
    name: { type: String, unique: true },
    text: String,
    creation_date: { type: Date, default: Date.now() }
});

pageSchema.methods.initial = function(body){
    this.name = body.name;
    this.text = body.text;
}

module.exports = mongoose.model('Page', pageSchema, 'pages');