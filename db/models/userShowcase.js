const mongoose = require('mongoose');

// Per-user selection of showcases and their order/config
const UserShowcaseSchema = mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  slug: { type: String, required: true },
  order: { type: Number, default: 0 },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  enabled: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

UserShowcaseSchema.index({ user_id: 1, order: 1 });
UserShowcaseSchema.index({ user_id: 1, slug: 1 });

UserShowcaseSchema.pre('save', function(next){ this.updated_at = new Date(); next(); });

module.exports = mongoose.model('UserShowcase', UserShowcaseSchema, 'user_showcases');

