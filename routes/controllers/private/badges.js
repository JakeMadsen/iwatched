const isLoggedIn = require('../../middleware/isLoggedIn');
const templatePath = 'private assets/template.ejs';
const path = require('path');
const fs = require('fs');
const Badge = require('../../../db/models/badge');
const User = require('../../../db/models/user');
const badgeSvc = require('../../services/badges');

function ensureDirSync(dir){
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
}

function sanitizeFilename(name){
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_\.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = (server) => {
  console.log('* Admin Badges Routes Loaded Into Server');

  // List + create form
  server.get('/admin/badges', isLoggedIn, async (req, res) => {
    const badges = await Badge.find({}).sort({ created_at: -1 }).lean();
    res.render(templatePath, {
      page_title: 'iWatched - Admin Badges',
      page_file: 'badges',
      page_data: { badges },
      user: req.user
    });
  });

  function parseLevelsFromBody(body){
    try {
      const raw = body.levels_json;
      if(!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map(it => ({ name: String(it.name||'').trim(), description: String(it.description||'').trim() })).filter(l => l.name);
    } catch (_) { return []; }
  }

  // Create badge
  server.post('/admin/badges', isLoggedIn, async (req, res) => {
    try {
      const title = (req.body && req.body.title || '').trim();
      const description = (req.body && req.body.description || '').trim();
      const slug = (req.body && (req.body.slug || title).toString().trim().toLowerCase().replace(/[^a-z0-9-_]/g,'-'));
      if (!title) return res.redirect('/admin/badges');

      const kind = (req.body && req.body.kind) || 'manual';
      let config = {};
      if (kind === 'tenure') {
        // parse thresholds like: bronze:365,silver:730
        const th = (req.body.thresholds || '').toString();
        const pairs = th.split(',').map(s=>s.trim()).filter(Boolean);
        const thresholds = [];
        pairs.forEach(p=>{
          const [level, days] = p.split(':');
          if(level && days && !isNaN(parseInt(days,10))) thresholds.push({ level: level.trim(), days: parseInt(days,10) });
        });
        config.thresholds = thresholds;
      } else if (kind === 'flag') {
        config.flag = (req.body.flag || '').toString().trim();
      }

      const levels = (req.body.mode === 'multi') ? parseLevelsFromBody(req.body) : [];
      const badge = new Badge({ slug, title, description, kind, config, levels });
      await badge.save();

      // Handle icon upload (optional)
      const files = req.files || {};
      const file = files.icon || files.badgeIcon || null;
      if (file) {
        const ext = path.extname(file.name || '.png').toLowerCase() || '.png';
        const base = sanitizeFilename(`${badge._id}-${title}`) + ext;
        const dir = path.join(__dirname, '../../../public/style/img/badges');
        ensureDirSync(dir);
        const full = path.join(dir, base);
        await file.mv(full);
        badge.icon = base;
        await badge.save();
      }
      res.redirect('/admin/badges');
    } catch (e) {
      res.redirect('/admin/badges');
    }
  });

  // Edit badge form
  server.get('/admin/badges/:id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
    const badge = await Badge.findById(req.params.id).lean();
    if (!badge) return res.redirect('/admin/badges');
    res.render(templatePath, {
      page_title: 'iWatched - Edit Badge',
      page_file: 'badge_edit',
      page_data: { badge },
      user: req.user
    });
  });

  // Update badge
  server.post('/admin/badges/:id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
    try {
      const badge = await Badge.findById(req.params.id);
      if (!badge) return res.redirect('/admin/badges');
      badge.title = (req.body.title || badge.title).trim();
      badge.description = (req.body.description || '').trim();
      badge.slug = (req.body.slug || badge.slug).toString().trim().toLowerCase().replace(/[^a-z0-9-_]/g,'-');
      if (req.body.mode === 'multi') {
        const levels = parseLevelsFromBody(req.body);
        badge.levels = levels;
      } else {
        badge.levels = [];
      }
      const kind = (req.body.kind || badge.kind);
      badge.kind = kind;
      const cfg = {};
      if (kind === 'tenure') {
        const th = (req.body.thresholds || '').toString();
        const thresholds = [];
        th.split(',').map(s=>s.trim()).filter(Boolean).forEach(p=>{
          const [level, days] = p.split(':');
          if(level && days && !isNaN(parseInt(days,10))) thresholds.push({ level: level.trim(), days: parseInt(days,10) });
        });
        cfg.thresholds = thresholds;
      } else if (kind === 'flag') {
        cfg.flag = (req.body.flag || '').toString().trim();
      }
      badge.config = cfg;
      badge.active = req.body.active === 'on' || req.body.active === '1' || req.body.active === 'true';

      // Optional icon upload
      const files = req.files || {};
      const file = files.icon || files.badgeIcon || null;
      if (file) {
        const ext = path.extname(file.name || '.png').toLowerCase() || '.png';
        const base = sanitizeFilename(`${badge._id}-${badge.title}`) + ext;
        const dir = path.join(__dirname, '../../../public/style/img/badges');
        ensureDirSync(dir);
        const full = path.join(dir, base);
        await file.mv(full);
        badge.icon = base;
      }
      await badge.save();
    } catch(_) {}
    res.redirect('/admin/badges/'+req.params.id);
  });

  // Assign manual badge to a user
  server.post('/admin/badges/assign', isLoggedIn, async (req, res) => {
    try {
      const user_id = (req.body.user_id || '').toString().trim();
      const username = (req.body.username || '').toString().trim();
      const badge_id = (req.body.badge_id || '').toString().trim();
      const level = (req.body.level || 'bronze').toString().trim();
      const badge = await Badge.findById(badge_id);
      if (!badge) return res.redirect('/admin/badges');
      let user = null;
      if (user_id) user = await User.findById(user_id);
      if (!user && username) user = await User.findOne({ 'local.username': username });
      if (!user) return res.redirect('/admin/badges');

      if (!user.profile) user.profile = {};
      if (!Array.isArray(user.profile.user_badges)) user.profile.user_badges = [];

      const has = (user.profile.user_badges || []).find(b => String(b.badge_id) === String(badge._id));
      if (has) { has.level = level || 'single'; has.awarded_at = new Date(); }
      else {
        user.profile.user_badges.push({ badge_id: badge._id, level: level || 'single', awarded_at: new Date() });
      }
      try { if (typeof user.markModified === 'function') user.markModified('profile'); await user.save(); }
      catch (e) {
        console.error('Assign badge save error:', e && e.message);
        try { await User.updateOne({ _id: user._id }, { $set: { profile: user.profile } }).exec(); } catch(_) {}
      }
    } catch(_) {}
    res.redirect('/admin/badges');
  });

  // Recompute auto badges for all users
  server.post('/admin/badges/recompute', isLoggedIn, async (req, res) => {
    try { await badgeSvc.recomputeAll(); } catch(_) {}
    res.redirect('/admin/badges');
  });

  // Delete badge
  server.post('/admin/badges/:id([0-9a-fA-F]{24})/delete', isLoggedIn, async (req, res) => {
    try {
      const badge = await Badge.findById(req.params.id);
      if (badge) {
        // Remove icon file if exists
        if (badge.icon) {
          const dir = path.join(__dirname, '../../../public/style/img/badges');
          const full = path.join(dir, badge.icon);
          try { fs.unlinkSync(full); } catch (_) {}
        }
        await badge.remove();
      }
    } catch (_) {}
    res.redirect('/admin/badges');
  });
}
