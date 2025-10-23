/*
*   Recommendation API (v1)
**************************/
const Recommendation = require('../../../../db/models/recommendation');
const User = require('../../../../db/models/user');
const apiIsCorrectUser = require('../../../middleware/apiIsCorrectUser');
const createError = require('http-errors');
const hub = require('../../../../bin/server/socketHub');

function oidMaybe(s){ return /^[0-9a-fA-F]{24}$/.test(String(s||'')); }

module.exports = (server) => {
  console.log('* Recommendations API Routes Loaded Into Server');

  // List received recommendations for a profile id
  server.get('/api/v1/recommendations/received/:profile_id', async (req, res) => {
    try {
      const uid = req.params.profile_id;
      if (!oidMaybe(uid)) return res.send(createError(400, 'Invalid profile id'));
      const items = await Recommendation.find({ receiver_id: uid, is_deleted: { $ne: true } }).sort({ date_updated: -1 }).limit(200).lean();
      res.send({ user_id: uid, total_results: items.length, results: items });
    } catch (e) { res.send(createError(400, e)); }
  });

  // List sent recommendations for a profile id
  server.get('/api/v1/recommendations/sent/:profile_id', async (req, res) => {
    try {
      const uid = req.params.profile_id;
      if (!oidMaybe(uid)) return res.send(createError(400, 'Invalid profile id'));
      const items = await Recommendation.find({ sender_id: uid, is_deleted: { $ne: true } }).sort({ date_updated: -1 }).limit(200).lean();
      res.send({ user_id: uid, total_results: items.length, results: items });
    } catch (e) { res.send(createError(400, e)); }
  });

  // Send a recommendation
  server.post('/api/v1/recommendations/send', apiIsCorrectUser, async (req, res) => {
    try {
      const { user_id, receiver_id, content_type, content_id, sender_note } = req.body || {};
      if (!oidMaybe(user_id) || !oidMaybe(receiver_id)) return res.status(400).send({ status: 400 });
      if (!['movie','show'].includes(String(content_type))) return res.status(400).send({ status: 400 });
      if (!content_id) return res.status(400).send({ status: 400 });
      const rec = new Recommendation({ sender_id: user_id, receiver_id, content_type, content_id: String(content_id), sender_note: String(sender_note||'').slice(0,500) });
      await rec.save();
      try { hub.emit('recommendation:new', { to_user_id: String(receiver_id), from_user_id: String(user_id), content_type, content_id: String(content_id), recommendation_id: String(rec._id) }); } catch(_){}
      res.status(200).send({ status: 'ok', id: rec._id });
    } catch (e) { res.status(500).send({ status: 500 }); }
  });

  // Update receiver status/note
  server.post('/api/v1/recommendations/status', apiIsCorrectUser, async (req, res) => {
    try {
      const { user_id, recommendation_id, receiver_status, receiver_note } = req.body || {};
      if (!oidMaybe(user_id) || !oidMaybe(recommendation_id)) return res.status(400).send({ status: 400 });
      if (!['pending','watched','liked','disliked'].includes(String(receiver_status))) return res.status(400).send({ status: 400 });
      const rec = await Recommendation.findOne({ _id: recommendation_id, receiver_id: user_id });
      if (!rec) return res.status(404).send({ status: 404 });
      rec.receiver_status = receiver_status;
      if (receiver_note != null) rec.receiver_note = String(receiver_note||'').slice(0,500);
      rec.date_updated = new Date();
      await rec.save();
      res.status(200).send({ status: 'ok' });
    } catch (e) { res.status(500).send({ status: 500 }); }
  });

  // Soft delete (either sender or receiver can remove their copy)
  server.post('/api/v1/recommendations/remove', apiIsCorrectUser, async (req, res) => {
    try {
      const { user_id, recommendation_id } = req.body || {};
      if (!oidMaybe(user_id) || !oidMaybe(recommendation_id)) return res.status(400).send({ status: 400 });
      const rec = await Recommendation.findOne({ _id: recommendation_id, $or: [ { sender_id: user_id }, { receiver_id: user_id } ] });
      if (!rec) return res.status(404).send({ status: 404 });
      rec.is_deleted = true; rec.date_updated = new Date();
      await rec.save();
      res.status(200).send({ status: 'ok' });
    } catch (e) { res.status(500).send({ status: 500 }); }
  });

  // Notifications: pending recommendations for a user
  server.get('/api/v1/recommendations/notifications/:user_id', async (req, res) => {
    try {
      const uid = String(req.params.user_id||'');
      const items = await Recommendation.find({ receiver_id: uid, is_deleted: { $ne: true }, receiver_status: 'pending', receiver_notified: { $ne: true } }).sort({ date_updated: -1 }).limit(10).lean();
      // Minimal payload for dropdown
      const senders = Array.from(new Set(items.map(r => String(r.sender_id))));
      const listUsers = await User.find({ _id: { $in: senders } }).select('_id local.username profile.custom_url').lean();
      const map = new Map(listUsers.map(u => [String(u._id), (u.local && u.local.username) || (u.profile && u.profile.custom_url) || 'user']));
      const results = items.map(r => ({ id: String(r._id), from_name: map.get(String(r.sender_id)) || 'user', content_type: r.content_type, content_id: r.content_id }));
      res.send({ user_id: uid, amount: results.length, results });
    } catch (e) { res.send(createError(400, e)); }
  });

  // Mark all recommendation notifications as seen for a user
  server.post('/api/v1/recommendations/notifications/mark', apiIsCorrectUser, async (req, res) => {
    try {
      const uid = String(req.body.user_id||'');
      await Recommendation.updateMany({ receiver_id: uid, receiver_notified: { $ne: true } }, { $set: { receiver_notified: true } });
      res.send({ status: 'ok' });
    } catch (e) { res.status(500).send({ status: 500 }); }
  });
}
