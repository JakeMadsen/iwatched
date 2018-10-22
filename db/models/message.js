var mongoose = require('mongoose');

var messageSchema = mongoose.Schema({
    title: String,
    type: String,
    text: String,
    email: String,
    from: String
});

messageSchema.methods.initial = function(message){
    this.title = message.title;
    this.type = message.type;
    this.text = message.text;
    this.email = message.email;
    this.from = message.from;
}

module.exports = mongoose.model('Message', messageSchema, 'messages');