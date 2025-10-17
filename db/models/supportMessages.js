var mongoose = require('mongoose');

var supportMessageSchema = mongoose.Schema({
    opened_by:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    opened_date:    { type: Date, default: Date.now },
    last_updated:   { type: Date, default: null },
    title:          { type: String },
    type:           { type: String },
    messages:       { type: Array, default: []},
    seen_by_user:   { type: Boolean, default: false },
    seen_by_support:{ type: Boolean, default: false },
    resolved:       { type: Boolean, default: false }
});
supportMessageSchema.index({ resolved: 1, last_updated: -1 });
supportMessageSchema.index({ opened_by: 1, resolved: 1, last_updated: -1 });

supportMessageSchema.methods.initial = function(data){
    let new_message = {
        date: Date.now(),
        message: data.message,
        user_id: data.user_id || data.opened_by,
        username: data.username,
        author_type: 'user'
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
        user_id: data.answered_by || data.user_id,
        username: data.username,
        author_type: support ? 'support' : 'user',
        persona_name: data.persona_name || null,
        persona_avatar: data.persona_avatar || null
    }

    if(user === true){
        this.seen_by_support = false;
        this.seen_by_user = true;
    }
    if(support === true){
        this.seen_by_support = true;
        this.seen_by_user = false;
    }

    this.resolved = false;
    this.last_updated = Date.now();
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
