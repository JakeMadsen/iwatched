const Report = require('../../../../db/models/report');
const User = require('../../../../db/models/user');

function oidMaybe(s){ return /^[0-9a-fA-F]{24}$/.test(String(s||'')); }

module.exports = (server) => {
  console.log('* Reports API Routes Loaded');

  // Create a report (auth required)
  server.post('/api/v1/reports', async (req, res) => {
    try {
      const user = req.user; if(!user) return res.status(401).json({ ok:false });
      const { reported_user_id, reason, context, meta } = req.body || {};
      if (!oidMaybe(reported_user_id)) return res.status(400).json({ ok:false, error:'invalid_target' });
      const ctx = ['comment','review','user','other'].includes(String(context)) ? String(context) : 'comment';
      const doc = new Report({
        reported_user_id: reported_user_id,
        reporter_user_id: user._id,
        reason: String(reason||'').slice(0, 1000),
        context: ctx,
        meta: {
          announcement_id: meta && meta.announcement_id ? String(meta.announcement_id) : null,
          comment_id: meta && meta.comment_id ? String(meta.comment_id) : null,
          review_id: meta && meta.review_id ? String(meta.review_id) : null
        }
      });
      await doc.save();
      res.json({ ok:true, id: String(doc._id) });
    } catch (e) { res.status(500).json({ ok:false }); }
  });

  // List reports (admin)
  server.get('/api/v1/admin/reports', async (req, res) => {
    try {
      const user = req.user; if(!(user && user.permissions && user.permissions.level && user.permissions.level.admin)) return res.status(403).json({ ok:false });
      const status = String(req.query.status||'open');
      const q = status ? { status } : {};
      const items = await Report.find(q).sort({ created_at: -1 }).limit(200).lean();
      // attach minimal user info
      const uids = Array.from(new Set(items.flatMap(r => [String(r.reported_user_id), String(r.reporter_user_id)])));
      const users = await User.find({ _id: { $in: uids } }).select('_id local.username profile.custom_url').lean();
      const map = new Map(users.map(u => [String(u._id), { name: (u.local&&u.local.username)|| (u.profile&&u.profile.custom_url)||'user', slug: (u.profile&&u.profile.custom_url)||null }]));
      const results = items.map(r => ({
        _id: String(r._id),
        context: r.context,
        created_at: r.created_at,
        status: r.status,
        reported: map.get(String(r.reported_user_id)) || null,
        reporter: map.get(String(r.reporter_user_id)) || null,
        meta: r.meta || {}
      }));
      res.json({ ok:true, results });
    } catch (e) { res.status(500).json({ ok:false }); }
  });

  // Get one report (admin)
  server.get('/api/v1/admin/reports/:id', async (req, res) => {
    try {
      const user = req.user; if(!(user && user.permissions && user.permissions.level && user.permissions.level.admin)) return res.status(403).json({ ok:false });
      const id = req.params.id; if(!oidMaybe(id)) return res.status(400).json({ ok:false });
      const r = await Report.findById(id).lean();
      if(!r) return res.status(404).json({ ok:false });
      res.json({ ok:true, report: r });
    } catch (e) { res.status(500).json({ ok:false }); }
  });

  // Add moderator comment (admin)
  server.post('/api/v1/admin/reports/:id/comment', async (req, res) => {
    try {
      const user = req.user; if(!(user && user.permissions && user.permissions.level && user.permissions.level.admin)) return res.status(403).json({ ok:false });
      const id = req.params.id; if(!oidMaybe(id)) return res.status(400).json({ ok:false });
      const text = String((req.body && req.body.text) || '').trim();
      if(!text) return res.status(400).json({ ok:false });
      const r = await Report.findById(id);
      if(!r) return res.status(404).json({ ok:false });
      r.moderator_notes.push({ by_user_id: user._id, text: text.slice(0,1000), at: new Date() });
      r.updated_at = new Date();
      await r.save();
      res.json({ ok:true });
    } catch (e) { res.status(500).json({ ok:false }); }
  });

  // Apply moderation action: mute
  server.post('/api/v1/admin/reports/:id/action/mute', async (req, res) => {
    try {
      const admin = req.user; if(!(admin && admin.permissions && admin.permissions.level && admin.permissions.level.admin)) return res.status(403).json({ ok:false });
      const id = req.params.id; if(!oidMaybe(id)) return res.status(400).json({ ok:false });
      const { permanently, until } = req.body || {};
      const r = await Report.findById(id);
      if(!r) return res.status(404).json({ ok:false });
      const user = await User.findById(r.reported_user_id);
      if(!user) return res.status(404).json({ ok:false });
      user.profile = user.profile || {};
      user.profile.moderation = user.profile.moderation || {};
      user.profile.moderation.permanently_muted = !!permanently;
      user.profile.moderation.muted_until = until ? new Date(until) : (permanently ? null : user.profile.moderation.muted_until);
      await user.save();
      r.actions.push({ type:'mute', by_user_id: admin._id, permanently: !!permanently, until: until ? new Date(until) : null, at: new Date() });
      r.status = 'action_taken'; r.updated_at = new Date();
      await r.save();
      res.json({ ok:true });
    } catch (e) { res.status(500).json({ ok:false }); }
  });

  // Resolve a report (admin)
  server.post('/api/v1/admin/reports/:id/resolve', async (req, res) => {
    try {
      const user = req.user; if(!(user && user.permissions && user.permissions.level && user.permissions.level.admin)) return res.status(403).json({ ok:false });
      const id = req.params.id; if(!oidMaybe(id)) return res.status(400).json({ ok:false });
      await Report.updateOne({ _id: id }, { $set: { status: 'resolved', updated_at: new Date() } }).exec();
      res.json({ ok:true });
    } catch (e) { res.status(500).json({ ok:false }); }
  });
}

