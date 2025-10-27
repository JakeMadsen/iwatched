const mongoose = require('mongoose');

const ModerationLogSchema = new mongoose.Schema({
  moderator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action_type: { type: String, required: true }, // e.g., ban_delete, delete_account, unban, mute
  reason: { type: String, default: '' },
  ip: { type: String, default: null },
  user_agent: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: false });

ModerationLogSchema.index({ timestamp: -1 });
ModerationLogSchema.index({ moderator_id: 1, timestamp: -1 });
ModerationLogSchema.index({ target_user_id: 1, timestamp: -1 });

module.exports = mongoose.model('ModerationLog', ModerationLogSchema, 'moderation_logs');

