const UserSession = require('../../db/models/userSession');
let geoip;
try { geoip = require('geoip-lite'); } catch (e) { geoip = null; }
let badgeSvc;
try { badgeSvc = require('../services/badges'); } catch (e) { badgeSvc = null; }

function getClientIp(req){
  const xf = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.ip || (req.connection && req.connection.remoteAddress) || '';
}

module.exports = async function trackSession(req, res, next){
  try {
    if (req.user && req.sessionID) {
      const sid = req.sessionID;
      const ip = getClientIp(req);
      const ua = req.headers['user-agent'] || '';
      let geo = null;
      if (geoip && ip) {
        try {
          const g = geoip.lookup(ip);
          if (g) geo = { country: g.country, region: (g.region||'').toString(), city: g.city };
        } catch (_) {}
      }

      await UserSession.updateOne(
        { sid },
        {
          $setOnInsert: { user_id: req.user._id, created_at: new Date() },
          $set: { ip, user_agent: ua, last_seen_at: new Date(), revoked: false, geo }
        },
        { upsert: true }
      ).exec();

      // Update auto badges; await to avoid unhandled rejections
      if (badgeSvc && typeof badgeSvc.evaluateUser === 'function') {
        try { await badgeSvc.evaluateUser(req.user); } catch (_) {}
      }
    }
  } catch (e) {
    // non-critical; do not block request flow
  } finally {
    next();
  }
}
