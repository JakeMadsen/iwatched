var mongoose = require('mongoose');

var supportMessageSchema = mongoose.Schema({
    opened_by:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    opened_date:    { type: Date, default: Date.now },
    last_updated:   { type: Date, default: null },
    title:          { type: String },
    type:           { type: String },
    messages:       { type: Array, deault: []},
    seen_by_user:   { type: Boolean, default: false },
    seen_by_support:{ type: Boolean, default: false },
    resolved:       { type: Boolean, default: false }
});

supportMessageSchema.methods.initial = function(data){
    let new_message = {
        date: Date.now(),
        message: data.message,
        user_id: data.user_id,
        username: data.username
    }

    this.opened_by      = data.opened_by;
    this.last_updated   = Date.now();
    this.title          = data.title;
    this.type           = data.type;
    this.messages.push(new_message);
}
supportMessageSchema.methods.newMessage = function(data, user, support) {

    let new_message = {
        date: Date.now(),
        message: data.message,
        user_id: data.answered_by,
        username: data.username
    }

    if(user == true ){
        this.seen_by_support    = !this.seenBySupport
        this.seen_by_user       = !this.seenByUser
    }
        
    if(support == true ){
        this.seen_by_support    = !this.seenBySupport
        this.seen_by_user       = !this.seenByUser
    }

    this.resolved = false;
    this.last_updated   = Date.now();
    this.messages.push(new_message);
}

supportMessageSchema.methods.resolve = function() {
    this.resolved = true;
}

supportMessageSchema.methods.seenByUser = function() {
    this.seen_by_user = true;
}

supportMessageSchema.methods.seenBySupport = function() {
    this.seen_by_support = true;
}



module.exports = mongoose.model('supportMessage', supportMessageSchema, 'support_messages');