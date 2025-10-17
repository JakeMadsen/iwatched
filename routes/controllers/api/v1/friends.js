const createError = require('http-errors');
const apiIsCorrectUser = require('../../../middleware/apiIsCorrectUser');
const userService = require('../../../services/users');
const FriendRequest = require('../../../../db/models/friendRequests');
const UserFriends = require('../../../../db/models/userFriends');
const User = require('../../../../db/models/user');

async function ensureUserFriendsDoc(user_id){
  let doc = await UserFriends.findOne({ user_id });
  if(!doc){ doc = new UserFriends({ user_id, friends: [] }); await doc.save(); }
  return doc;
}

module.exports = function(server){
  console.log('* Friends API Routes Loaded Into Server');

  // Send friend request
  server.post('/api/v1/friends/request', apiIsCorrectUser, async (req, res) => {
    try{
      const from = String(req.body.user_id);
      const to = String(req.body.to_user_id || '');
      if(!to || from === to) return res.send(createError(400, 'invalid_target'));

      const targetUser = await userService.getOne(to);
      if(!targetUser) return res.send(createError(404, 'user_not_found'));

      const alreadyFriendsA = await UserFriends.findOne({ user_id: from, 'friends.user_id': to });
      const alreadyFriendsB = await UserFriends.findOne({ user_id: to, 'friends.user_id': from });
      if(alreadyFriendsA && alreadyFriendsB) return res.send({ status: 200, message: 'already_friends' });

      const existing = await FriendRequest.findOne({ $or: [ { from_user_id: from, to_user_id: to, status: 'pending' }, { from_user_id: to, to_user_id: from, status: 'pending' } ] });
      if(existing && existing.status === 'pending') return res.send({ status: 200, message: 'request_already_pending' });

      await FriendRequest.updateOne(
        { from_user_id: from, to_user_id: to },
        { $set: { status: 'pending' } },
        { upsert: true }
      );
      res.send({ status: 200, message: 'request_sent' });
    }catch(e){ res.send(createError(400, e.message || 'request_failed')); }
  });

  // Respond to friend request (accept/deny) by the recipient
  server.post('/api/v1/friends/respond', apiIsCorrectUser, async (req, res) => {
    try{
      const to = String(req.body.user_id); // current user
      const from = String(req.body.from_user_id || '');
      const action = String(req.body.action || '').toLowerCase();
      if(!from || !['accept','deny'].includes(action)) return res.send(createError(400, 'invalid_request'));

      const fr = await FriendRequest.findOne({ from_user_id: from, to_user_id: to, status: 'pending' });
      if(!fr) return res.send(createError(404, 'request_not_found'));

      if(action === 'deny'){
        fr.status = 'denied';
        await fr.save();
        return res.send({ status: 200, message: 'request_denied' });
      }

      // accept
      await ensureUserFriendsDoc(from);
      await ensureUserFriendsDoc(to);

      await UserFriends.updateOne({ user_id: from }, { $addToSet: { friends: { user_id: to } } });
      await UserFriends.updateOne({ user_id: to },   { $addToSet: { friends: { user_id: from } } });

      fr.status = 'accepted';
      await fr.save();

      res.send({ status: 200, message: 'request_accepted' });
    }catch(e){ res.send(createError(400, e.message || 'respond_failed')); }
  });

  // Remove friend (both sides)
  server.post('/api/v1/friends/remove', apiIsCorrectUser, async (req, res) => {
    try{
      const userId = String(req.body.user_id);
      const friendId = String(req.body.friend_user_id || '');
      if(!friendId) return res.send(createError(400, 'invalid_target'));

      await ensureUserFriendsDoc(userId);
      await ensureUserFriendsDoc(friendId);

      await UserFriends.updateOne({ user_id: userId },  { $pull: { friends: { user_id: friendId } } });
      await UserFriends.updateOne({ user_id: friendId },{ $pull: { friends: { user_id: userId } } });
      res.send({ status: 200, message: 'removed' });
    }catch(e){ res.send(createError(400, e.message || 'remove_failed')); }
  });

  // List friends (enriched)
  server.get('/api/v1/friends/list/:user_id', async (req, res) => {
    try{
      const uid = String(req.params.user_id);
      const doc = await UserFriends.findOne({ user_id: uid }).lean();
      const friends = (doc && doc.friends) || [];
      const enriched = await Promise.all(friends.map(async f => {
        const u = await User.findById(f.user_id).lean();
        return {
          id: String(f.user_id),
          since: f.since,
          username: u && u.local ? u.local.username : null,
          slug: u && u.profile ? u.profile.custom_url : null,
          avatar: (u && u.profile && u.profile.profile_image)
            ? `/static/style/img/profile_images/users/${u._id}/${u.profile.profile_image}`
            : null
        };
      }));
      res.send({ user_id: uid, friends: enriched });
    }catch(e){ res.send(createError(400, e.message || 'list_failed')); }
  });

  // Pending requests for a user
  server.get('/api/v1/friends/requests/:user_id', async (req, res) => {
    try{
      const uid = String(req.params.user_id);
      const incoming = await FriendRequest.find({ to_user_id: uid, status: 'pending' }).lean();
      const outgoing = await FriendRequest.find({ from_user_id: uid, status: 'pending' }).lean();

      async function lightUser(id){
        const u = await User.findById(id).lean();
        if(!u) return { id };
        return {
          id: String(u._id),
          username: u.local && u.local.username,
          slug: u.profile && u.profile.custom_url,
          avatar: (u.profile && u.profile.profile_image)
            ? `/static/style/img/profile_images/users/${u._id}/${u.profile.profile_image}`
            : null
        };
      }

      const incomingRich = await Promise.all(incoming.map(async r => ({
        id: String(r._id), from: await lightUser(r.from_user_id), to: await lightUser(r.to_user_id), status: r.status
      })));
      const outgoingRich = await Promise.all(outgoing.map(async r => ({
        id: String(r._id), from: await lightUser(r.from_user_id), to: await lightUser(r.to_user_id), status: r.status
      })));

      res.send({ incoming: incomingRich, outgoing: outgoingRich });
    }catch(e){ res.send(createError(400, e.message || 'requests_failed')); }
  });

  // Count incoming pending
  server.get('/api/v1/friends/requests/count/:user_id', async (req, res) => {
    try{
      const uid = String(req.params.user_id);
      const count = await FriendRequest.countDocuments({ to_user_id: uid, status: 'pending' });
      res.send({ user_id: uid, count });
    }catch(e){ res.send(createError(400, e.message || 'count_failed')); }
  });

  // Relationship status between two users
  server.get('/api/v1/friends/status', async (req, res) => {
    try{
      const a = String(req.query.user_id || '');
      const b = String(req.query.other_id || '');
      if(!a || !b || a === b) return res.send({ status: 'self' });

      const aDoc = await UserFriends.findOne({ user_id: a, 'friends.user_id': b });
      const bDoc = await UserFriends.findOne({ user_id: b, 'friends.user_id': a });
      if(aDoc && bDoc) return res.send({ status: 'friends' });

      const incoming = await FriendRequest.findOne({ from_user_id: b, to_user_id: a, status: 'pending' });
      if(incoming) return res.send({ status: 'pending_incoming' });

      const outgoing = await FriendRequest.findOne({ from_user_id: a, to_user_id: b, status: 'pending' });
      if(outgoing) return res.send({ status: 'pending_outgoing' });

      return res.send({ status: 'none' });
    }catch(e){ res.send(createError(400, e.message || 'status_failed')); }
  });
}
