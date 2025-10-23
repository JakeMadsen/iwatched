var mongoose = require('mongoose');

var recommendationSchema = new mongoose.Schema({
  sender_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  receiver_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  content_type:    { type: String, enum: ['movie', 'show'], required: true, index: true },
  content_id:      { type: String, required: true }, // TMDb ID or internal reference
  sender_note:     { type: String, default: "" },
  receiver_note:   { type: String, default: "" },
  receiver_status: { type: String, enum: ['pending', 'watched', 'liked', 'disliked'], default: 'pending' },
  sender_notified: { type: Boolean, default: false },
  receiver_notified: { type: Boolean, default: false },
  date_sent:       { type: Date, default: Date.now },
  date_updated:    { type: Date, default: Date.now },
  is_deleted:      { type: Boolean, default: false }
});

recommendationSchema.index({ sender_id: 1, receiver_id: 1, content_type: 1, content_id: 1 });

recommendationSchema.pre('save', function(next){
  this.date_updated = new Date();
  next();
});

module.exports = mongoose.model('Recommendation', recommendationSchema, 'recommendations');
