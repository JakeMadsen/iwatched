const mongoose = require('mongoose');

const bannedAccountSchema = new mongoose.Schema({
  email: { type: String, index: true, required: true },
  ip: { type: String, default: null },
  hardware_id: { type: String, default: null },
  reason: { type: String, default: '' },
  moderator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  moderator_name: { type: String, default: null },
  date_banned: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('BannedAccount', bannedAccountSchema, 'banned_accounts');
