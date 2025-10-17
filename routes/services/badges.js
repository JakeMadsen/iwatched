const mongoose = require('mongoose');
const Badge = require('../../db/models/badge');
const User = require('../../db/models/user');

const DEFAULT_LEVEL_ORDER = ['bronze','silver','gold','platinum','diamond'];
function rankByBadge(badge, level){
  const name = typeof level === 'string' ? level : (level && level.name) || 'single';
  if (Array.isArray(badge.levels) && badge.levels.length){
    const idx = badge.levels.findIndex(l => (l && (l.name||l)) === name);
    return idx === -1 ? 0 : idx;
  }
  const i = DEFAULT_LEVEL_ORDER.indexOf(name);
  return i === -1 ? 0 : i;
}

async function evaluateUser(user){
  if (!user) return;
  if (!user.profile) user.profile = {};
  if (!Array.isArray(user.profile.user_badges)) user.profile.user_badges = [];
  const all = await Badge.find({ active: true }).lean();
  const now = Date.now();
  const reg = (user.profile.registration_date) ? new Date(user.profile.registration_date).getTime() : now;

  const currentMap = new Map();
  for (const b of user.profile.user_badges) {
    currentMap.set(String(b.badge_id), b);
  }

  const updates = [];
  for (const badge of all) {
    let desiredLevel = null;
    if (badge.kind === 'tenure') {
      const th = (badge.config && badge.config.thresholds) || [];
      // pick highest level whose days threshold is met
      let best = null;
      th.forEach(t => {
        const days = parseInt(t.days, 10) || 0;
        const lv = t.level || 'bronze';
        if (now - reg >= days * 24*60*60*1000) {
          if (!best || rankByBadge(badge, lv) > rankByBadge(badge, best)) best = lv;
        }
      });
      if (best) desiredLevel = best;
    } else if (badge.kind === 'flag') {
      const flag = badge.config && badge.config.flag;
      const flags = (user.profile && user.profile.flags) || {};
      if (flag && flags[flag]) {
        if (Array.isArray(badge.levels) && badge.levels.length) {
          desiredLevel = (badge.levels[0] && (badge.levels[0].name || badge.levels[0])) || 'single';
        } else {
          desiredLevel = 'single';
        }
      }
    } else {
      // manual: do nothing automatically
    }

    if (desiredLevel) {
      const existing = currentMap.get(String(badge._id));
      if (!existing) {
        user.profile.user_badges.push({ badge_id: badge._id, level: desiredLevel, awarded_at: new Date() });
      } else if (rankByBadge(badge, desiredLevel) > rankByBadge(badge, existing.level)) {
        existing.level = desiredLevel;
        existing.awarded_at = new Date();
      }
    }
  }
  try {
    if (typeof user.markModified === 'function') user.markModified('profile');
    if (typeof user.save === 'function') {
      return await user.save();
    }
  } catch (e) {
    if (process.env.BADGES_DEBUG) console.error('[Badges] save(user) failed:', e && e.message);
  }
  try {
    // Fallback for non-document objects
    return await User.updateOne({ _id: user._id }, { $set: { profile: user.profile } }).exec();
  } catch (e) {
    if (process.env.BADGES_DEBUG) console.error('[Badges] updateOne fallback failed:', e && e.message);
    return null;
  }
}

async function recomputeAll(){
  const cursor = User.find({}).cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    try { await evaluateUser(doc); } catch(e) {
      if (process.env.BADGES_DEBUG) console.error('[Badges] recompute error for', doc && doc._id, e && e.message);
    }
  }
}

module.exports = { evaluateUser, recomputeAll };
