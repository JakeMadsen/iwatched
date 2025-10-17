const mongoose = require('mongoose');

const userSessionSchema = mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
  sid: { type: String, index: { unique: true } },
  ip: { type: String },
  user_agent: { type: String },
  geo: {
    country: String,
    region: String,
    city: String
  },
  created_at: { type: Date, default: Date.now },
  last_seen_at: { type: Date, default: Date.now },
  revoked: { type: Boolean, default: false }
});

module.exports = mongoose.model('UserSession', userSessionSchema, 'user_sessions_meta');

