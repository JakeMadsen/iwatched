const mongoose = require('mongoose');
const UserSession = require('../../db/models/userSession');

function getSessionCollection(){
  return mongoose.connection.collection('user_sessions');
}

async function listUserSessions(userId, currentSid){
  // Read metadata from our collection first
  const meta = await UserSession.find({ user_id: userId }).lean();
  // Cross-check which sessions are actually active in connect-mongo store
  const coll = getSessionCollection();
  const docs = await coll.find({}).toArray();
  const activeSids = new Set();
  for (const d of docs) {
    try {
      const s = JSON.parse(d.session);
      if (s && s.passport && String(s.passport.user) === String(userId)) {
        activeSids.add(String(d._id));
      }
    } catch (_) {}
  }
  const now = Date.now();
  return (meta || []).map(m => ({
    sid: m.sid,
    current: String(m.sid) === String(currentSid),
    active: activeSids.has(String(m.sid)) && !m.revoked,
    ip: m.ip,
    user_agent: m.user_agent,
    geo: m.geo || null,
    created_at: m.created_at,
    last_seen_at: m.last_seen_at,
    revoked: !!m.revoked,
  })).sort((a,b) => new Date(b.last_seen_at||0) - new Date(a.last_seen_at||0));
}

async function revokeSession(userId, sid){
  await UserSession.updateOne({ user_id: userId, sid }, { $set: { revoked: true } }).exec();
  try {
    await getSessionCollection().deleteOne({ _id: sid });
  } catch (_) {}
}

async function revokeOtherSessions(userId, currentSid){
  const coll = getSessionCollection();
  const docs = await coll.find({}).toArray();
  const toDelete = [];
  for (const d of docs) {
    try {
      const s = JSON.parse(d.session);
      if (s && s.passport && String(s.passport.user) === String(userId) && String(d._id) !== String(currentSid)) {
        toDelete.push(String(d._id));
      }
    } catch (_) {}
  }
  if (toDelete.length) {
    await coll.deleteMany({ _id: { $in: toDelete } });
  }
  await UserSession.updateMany({ user_id: userId, sid: { $in: toDelete } }, { $set: { revoked: true } }).exec();
}

module.exports = { listUserSessions, revokeSession, revokeOtherSessions };

