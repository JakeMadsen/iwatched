const mongoose = require('mongoose');

const FriendRequestSchema = mongoose.Schema({
  from_user_id: { type: String, required: true },
  to_user_id: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'denied'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

FriendRequestSchema.index({ from_user_id: 1, to_user_id: 1 }, { unique: true });

module.exports = mongoose.model('friend_requests', FriendRequestSchema);

