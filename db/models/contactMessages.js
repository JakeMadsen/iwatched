var mongoose = require('mongoose');

var messageSchema = mongoose.Schema({
    title: String,
    type: String,
    text: String,
    email: String,
    from: String,
    // Anti-spam + metadata
    is_spam: { type: Boolean, default: false },
    spam_reason: { type: String, default: null },
    ip: { type: String, default: null },
    ua: { type: String, default: null },
    created_at: { type: Date, default: Date.now }
});

messageSchema.methods.initial = function(message){
    this.title = message.title;
    this.type = message.type;
    this.text = message.text;
    this.email = message.email;
    this.from = message.from;
}

module.exports = mongoose.model('contactMessage', messageSchema, 'contact_messages');
