const Announcement = require('../../../../db/models/announcement');
let hub; try { hub = require('../../../../bin/server/socketHub'); } catch (_) { hub = { emit: ()=>{} }; }
const User = require('../../../../db/models/user');

module.exports = function(server){
  function slugify(s){
    return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80);
  }

  // Latest announcement
  server.get('/api/v1/announcements/latest', async (req, res) => {
    try {
      const a = await Announcement.findOne({}).sort({ created_at: -1 }).lean();
      res.json({ announcement: a || null });
    } catch (e) {
      res.status(500).json({ announcement: null });
    }
  });

  // Helper: resolve mentions case-insensitively for username or custom_url
  async function resolveMentionedUserIds(names){
    if(!names || !names.length) return [];
    const ors = [];
    names.forEach(n => {
      const rx = new RegExp('^' + n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$', 'i');
      ors.push({ 'local.username': { $regex: rx } });
      ors.push({ 'profile.custom_url': { $regex: rx } });
    });
    const users = await User.find({ $or: ors }).select('_id').lean().catch(()=>[]);
    const uniq = Array.from(new Set((users||[]).map(u => String(u._id))));
    return uniq;
  }

  // List announcements (paginated)
  server.get('/api/v1/announcements', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const size = Math.min(25, Math.max(1, parseInt(req.query.size || '10', 10)));
    try {
      const items = await Announcement.find({}).sort({ created_at: -1 }).skip((page-1)*size).limit(size).lean();
      const total = await Announcement.countDocuments({});
      res.json({ items, page, size, total });
    } catch (e) {
      res.status(500).json({ items: [], page, size, total: 0 });
    }
  });

  // Core handler to get one announcement
  async function handleGetOne(req, res){
    try {
      const idParamRaw = (req.params && req.params.id) || '';
      const idParam = String(idParamRaw).split('-')[0]; // tolerate id-slug format
      let a = null;
      try {
        if (idParam && require('mongoose').Types.ObjectId.isValid(idParam)) {
          a = await Announcement.findById(idParam).lean();
        }
      } catch (_) {}
      // Fallback: some docs may (unexpectedly) have string _id values
      if (!a) {
        try { a = await Announcement.collection.findOne({ _id: idParam }); } catch (_) {}
      }
      // Last resort: allow lookup by slug if someone passed that as :id
      if (!a) {
        try { a = await Announcement.findOne({ slug: idParam }).lean(); } catch (_) {}
      }
      if (!a) return res.status(404).json({ announcement: null });
      // Enrich comments with avatar + profile link
      try {
        const comments = Array.isArray(a.comments) ? a.comments : [];
        const ids = comments.map(c => c.user_id).filter(Boolean);
        const uniq = Array.from(new Set(ids.map(String)));
        if (uniq.length) {
          const User = require('../../../../db/models/user');
          const users = await User.find({ _id: { $in: uniq } })
            .select('_id local.username profile.custom_url profile.profile_image profile.featured_badge_id profile.user_badges')
            .lean();
          const map = new Map(users.map(u => [String(u._id), u]));
          // Preload featured badge metadata
          let badgeMap = new Map();
          try {
            const badgeIds = Array.from(new Set((users||[]).map(u => u && u.profile && u.profile.featured_badge_id).filter(Boolean).map(String)));
            if (badgeIds.length){
              const Badge = require('../../../../db/models/badge');
              const bdocs = await Badge.find({ _id: { $in: badgeIds } }).select('_id title description icon').lean();
              badgeMap = new Map((bdocs||[]).map(b => [String(b._id), b]));
            }
          } catch(_){}
          a.comments = comments.map(c => {
            const u = c.user_id ? map.get(String(c.user_id)) : null;
            const username = u && u.local && u.local.username;
            const slug = u && u.profile && u.profile.custom_url;
            const img = (u && u.profile && u.profile.profile_image)
              ? `/static/style/img/profile_images/users/${u._id}/${u.profile.profile_image}`
              : '/static/style/img/profile_images/users/default/picture_default.png';
            const link = slug ? `/${slug}` : (u ? `/${u._id}` : '#');
            const handle = slug ? `@${slug}` : (username ? `@${username}` : '@user');
            // Featured badge
            let badge_icon = null, badge_title = null, badge_desc = null, badge_awarded = null, badge_level = null;
            try {
              const fid = u && u.profile && u.profile.featured_badge_id ? String(u.profile.featured_badge_id) : null;
              if (fid){
                const bd = badgeMap.get(fid);
                if (bd){
                  badge_icon = bd.icon ? ('/static/style/img/badges/' + bd.icon) : null;
                  badge_title = bd.title || null;
                  badge_desc = bd.description || '';
                  const owned = Array.isArray(u.profile.user_badges) ? u.profile.user_badges.find(b => String(b.badge_id) === fid) : null;
                  badge_awarded = owned && owned.awarded_at || null;
                  badge_level = owned && owned.level || 'single';
                }
              }
            } catch(_){}
            const upCount = Array.isArray(c.upvotes) ? c.upvotes.length : 0;
            const downCount = Array.isArray(c.downvotes) ? c.downvotes.length : 0;
            let userVote = null;
            try {
              if (req.user) {
                const uid = String(req.user._id);
                if ((c.upvotes||[]).map(String).includes(uid)) userVote = 'up';
                else if ((c.downvotes||[]).map(String).includes(uid)) userVote = 'down';
              }
            } catch(_){}
            return Object.assign({}, c, { user_avatar: img, user_link: link, user_handle: handle, user_badge_icon: badge_icon, user_badge_title: badge_title, user_badge_desc: badge_desc, user_badge_awarded_at: badge_awarded, user_badge_level: badge_level, upvote_count: upCount, downvote_count: downCount, user_vote: userVote });
          });
        }
      } catch(_) {}
      res.json({ announcement: a });
    } catch (e) {
      res.status(404).json({ announcement: null });
    }
  }

  // Add a comment (auth required)
  // comment rate-limit map (per-process)
  const lastCommentAt = new Map();
  server.post('/api/v1/announcements/:id/comment', async (req, res) => {
    try {
      const id = req.params.id;
      const user = req.user;
      if(!user) return res.status(401).json({ ok:false });
      const msg = (req.body && req.body.message || '').toString().trim();
      if(!msg) return res.status(400).json({ ok:false, error:'empty' });
      if(msg.length > 2000) return res.status(400).json({ ok:false, error:'too_long' });
      const now = Date.now();
      const key = String(user._id);
      const prev = lastCommentAt.get(key) || 0;
      if (now - prev < 30*1000) return res.status(429).json({ ok:false, error:'rate_limited' });
      lastCommentAt.set(key, now);
      const username = (user.local && user.local.username) || 'User';
      const created = { user_id: user._id, username, message: msg, created_at: new Date(), parent_id: null };
      await Announcement.findByIdAndUpdate(id, { $push: { comments: created } }, { new: false }).lean();
      // Mentions notifications (@username or @custom_url)
      try {
        const names = Array.from(new Set((msg.match(/@([A-Za-z0-9_\-]+)/g)||[]).map(s=>s.slice(1))));
        const ids = await resolveMentionedUserIds(names);
        ids.forEach(uid => { if (uid !== String(user._id)) hub.emit('activity:mention', { to_user_id: uid, from_user_id: String(user._id), type:'announcement-mention', announcement_id: id }); });
      } catch(_){ }
      res.json({ ok:true });
    } catch (e) {
      res.status(500).json({ ok:false });
    }
  });
  
  // Get one announcement (robust ID handling)
  server.get('/api/v1/announcements/:id', handleGetOne);
  // Also support id-slug shape for resilience
  server.get('/api/v1/announcements/:id-:slug', handleGetOne);

  // Create a reply (1-level nesting)
  server.post('/api/v1/announcements/:id/comment/:comment_id/reply', async (req, res) => {
    try {
      const user = req.user; if(!user) return res.status(401).json({ ok:false });
      const msg = (req.body && req.body.message || '').toString().trim();
      if(!msg) return res.status(400).json({ ok:false, error:'empty' });
      const a = await Announcement.findById(req.params.id);
      if(!a) return res.status(404).json({ ok:false });
      const username = (user.local && user.local.username) || 'User';
      const parentId = req.params.comment_id;
      // ensure we attach to root parent
      const parent = a.comments.id(parentId);
      const rootParentId = parent && parent.parent_id ? parent.parent_id : parentId;
      a.comments.push({ user_id: user._id, username, message: msg, parent_id: rootParentId, created_at: new Date() });
      await a.save();
      // Notify parent author
      try {
        const p = a.comments.id(rootParentId);
        if (p && String(p.user_id) !== String(user._id)) {
          hub.emit('activity:reply', { to_user_id: String(p.user_id), from_user_id: String(user._id), type:'announcement-reply', announcement_id: req.params.id, parent_comment_id: rootParentId });
        }
      } catch(_){ }
      // Mention notifications
      try {
        const names = Array.from(new Set((msg.match(/@([A-Za-z0-9_\-]+)/g)||[]).map(s=>s.slice(1))));
        const ids = await resolveMentionedUserIds(names);
        ids.forEach(uid => { if (uid !== String(user._id)) hub.emit('activity:mention', { to_user_id: uid, from_user_id: String(user._id), type:'announcement-mention', announcement_id: req.params.id }); });
      } catch(_){ }
      res.json({ ok:true });
    } catch (e) { res.status(500).json({ ok:false }); }
  });

  // Edit a comment
  server.post('/api/v1/announcements/:id/comment/:comment_id/edit', async (req, res) => {
    try {
      const user = req.user; if(!user) return res.status(401).json({ ok:false });
      const a = await Announcement.findById(req.params.id);
      if(!a) return res.status(404).json({ ok:false });
      const msg = (req.body && req.body.message || '').toString().trim();
      if(!msg) return res.status(400).json({ ok:false });
      const c = a.comments.id(req.params.comment_id);
      if(!c) return res.status(404).json({ ok:false });
      const isOwner = String(c.user_id||'') === String(user._id||'');
      const isAdmin = !!(user.permissions && user.permissions.level && user.permissions.level.admin);
      if(!isOwner && !isAdmin) return res.status(403).json({ ok:false });
      if (c.deleted) return res.status(400).json({ ok:false });
      c.message = msg; c.edited_at = new Date();
      await a.save();
      res.json({ ok:true });
    } catch (e) { res.status(500).json({ ok:false }); }
  });

  // Delete a comment
  // mode: 'soft' (default) -> mark as deleted (keeps replies)
  //       'hard' (admin only) -> remove the comment and its direct replies (thread)
  server.post('/api/v1/announcements/:id/comment/:comment_id/delete', async (req, res) => {
    try {
      const user = req.user; if(!user) return res.status(401).json({ ok:false });
      const a = await Announcement.findById(req.params.id);
      if(!a) return res.status(404).json({ ok:false });
      const c = a.comments.id(req.params.comment_id);
      if(!c) return res.status(404).json({ ok:false });
      const isOwner = String(c.user_id||'') === String(user._id||'');
      const isAdmin = !!(user.permissions && user.permissions.level && user.permissions.level.admin);
      if(!isOwner && !isAdmin) return res.status(403).json({ ok:false });
      const mode = (req.body && req.body.mode) || 'soft';
      if (mode === 'hard') {
        if (!isAdmin) return res.status(403).json({ ok:false });
        const targetId = String(c._id);
        a.comments = (a.comments || []).filter(cm => {
          // remove the comment itself
          if (String(cm._id) === targetId) return false;
          // remove direct replies (parent_id equals the parent id)
          if (String(cm.parent_id||'') === targetId) return false;
          return true;
        });
        await a.save();
        return res.json({ ok:true, hard:true });
      } else {
        c.deleted = true; // soft delete
        await a.save();
        return res.json({ ok:true, hard:false });
      }
    } catch (e) { res.status(500).json({ ok:false }); }
  });

  // Vote on a comment
  server.post('/api/v1/announcements/:id/comment/:comment_id/vote', async (req, res) => {
    try {
      const user = req.user; if(!user) return res.status(401).json({ ok:false });
      const action = (req.body && req.body.action || '').toString();
      const a = await Announcement.findById(req.params.id);
      if(!a) return res.status(404).json({ ok:false });
      const c = a.comments.id(req.params.comment_id);
      if(!c) return res.status(404).json({ ok:false });
      const uid = user._id;
      c.upvotes = (c.upvotes||[]).filter(x => String(x) !== String(uid));
      c.downvotes = (c.downvotes||[]).filter(x => String(x) !== String(uid));
      if(action === 'up') c.upvotes.push(uid);
      else if(action === 'down') c.downvotes.push(uid);
      await a.save();
      res.json({ ok:true, up: (c.upvotes||[]).length, down: (c.downvotes||[]).length });
    } catch (e) { res.status(500).json({ ok:false }); }
  });

  // Record a unique impression
  server.post('/api/v1/announcements/:id/impression', async (req, res) => {
    try {
      const id = req.params.id;
      const user = req.user;
      if(!user) return res.json({ ok:true }); // only count logged-in unique users for now
      await Announcement.updateOne({ _id: id, 'impressions.user_id': { $ne: user._id } }, { $push: { impressions: { user_id: user._id, at: new Date() } } }).exec();
      res.json({ ok:true });
    } catch (e) {
      res.status(500).json({ ok:false });
    }
  });

  // Admin: create announcement
  server.post('/api/v1/admin/announcements', async (req, res) => {
    try {
      const user = req.user;
      if(!(user && user.permissions && user.permissions.level && user.permissions.level.admin)){
        return res.status(403).json({ ok:false });
      }
      const title = (req.body && req.body.title || '').toString().trim();
      const text = (req.body && req.body.text || '').toString().trim();
      if(!title || !text) return res.status(400).json({ ok:false });
      const a = await Announcement.create({ title, text, slug: slugify(title) });
      res.json({ ok:true, id: a._id, slug: a.slug });
    } catch (e) {
      res.status(500).json({ ok:false });
    }
  });

  // Admin: update announcement
  server.post('/api/v1/admin/announcements/:id', async (req, res) => {
    try {
      const user = req.user;
      if(!(user && user.permissions && user.permissions.level && user.permissions.level.admin)){
        return res.status(403).json({ ok:false });
      }
      const title = (req.body && req.body.title || '').toString().trim();
      const text = (req.body && req.body.text || '').toString().trim();
      const patch = {};
      if(title){ patch.title = title; patch.slug = slugify(title); }
      if(text){ patch.text = text; }
      await Announcement.updateOne({ _id: req.params.id }, { $set: patch }).exec();
      res.json({ ok:true });
    } catch (e) {
      res.status(500).json({ ok:false });
    }
  });

  // Admin: delete announcement
  server.delete('/api/v1/admin/announcements/:id', async (req, res) => {
    try {
      const user = req.user;
      if(!(user && user.permissions && user.permissions.level && user.permissions.level.admin)){
        return res.status(403).json({ ok:false });
      }
      await Announcement.deleteOne({ _id: req.params.id }).exec();
      res.json({ ok:true });
    } catch (e) {
      res.status(500).json({ ok:false });
    }
  });
}
