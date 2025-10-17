const mongoose = require('mongoose');

const FriendSchema = mongoose.Schema({
  user_id: { type: String, required: true },
  since: { type: Date, default: Date.now }
}, { _id: false });

const UserFriendsSchema = mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  friends: { type: [FriendSchema], default: [] }
});

UserFriendsSchema.methods.addFriend = function(friend_user_id){
  const exists = this.friends.some(f => String(f.user_id) === String(friend_user_id));
  if(!exists){ this.friends.push({ user_id: friend_user_id, since: new Date() }); }
};

UserFriendsSchema.methods.removeFriend = function(friend_user_id){
  this.friends = this.friends.filter(f => String(f.user_id) !== String(friend_user_id));
};

module.exports = mongoose.model('user_friends', UserFriendsSchema);

