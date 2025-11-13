const Review = require('../../../../db/models/review');
const User = require('../../../../db/models/user');
const SiteSetting = require('../../../../db/models/siteSetting');
const apiIsCorrectUser = require('../../../middleware/apiIsCorrectUser');

module.exports = function(server){
  async function getNumericSetting(key, fallback){
    try {
      const s = await SiteSetting.findOne({ key }).lean();
      const v = s && (typeof s.value === 'number' ? s.value : Number(s.value));
      return isNaN(v) ? fallback : v;
    } catch (_) { return fallback; }
  }
  // Helper: enrich a list of reviews with author names and user vote flags
  async function enrichReviews(list, currentUser){
    try {
      const uids = Array.from(new Set((list||[]).map(r => r.author_id).filter(Boolean).map(String)));
      let users = [];
      if (uids.length){
        users = await User.find({ _id: { $in: uids } })
          .select('_id local.username profile.custom_url profile.profile_image')
          .lean();
      }
      const umap = new Map((users||[]).map(u => [String(u._id), u]));
      const me = currentUser && String(currentUser._id);
      return (list||[]).map(r => {
        const u = r.author_id ? umap.get(String(r.author_id)) : null;
        const username = (u && u.local && u.local.username) || r.author_username || '';
        const slug = u && u.profile && u.profile.custom_url;
        const img = (u && u.profile && u.profile.profile_image && u.profile.profile_image !== 'profile-picture-missing.png')
          ? `/static/style/img/profile_images/users/${u._id}/${u.profile.profile_image}`
          : '/static/style/img/standard/standard_avatar.png';
        const link = slug ? `/${slug}` : (u ? `/${u._id}` : '#');
        const user_vote = (me && r.upvotes && r.upvotes.map(String).includes(me)) ? 'up' : ((me && r.downvotes && r.downvotes.map(String).includes(me)) ? 'down' : null);
        const upvote_count = (r.upvotes||[]).length;
        const downvote_count = (r.downvotes||[]).length;
        return Object.assign({}, r, { username, user_link: link, user_avatar: img, user_vote, upvote_count, downvote_count });
      });
    } catch (e) {
      return list||[];
    }
  }

  // List reviews for an item
  server.get('/api/v1/reviews', async (req, res) => {
    try {
      const type = String(req.query.type||'').toLowerCase();
      const id = String(req.query.id||'');
      if (!type || !id || !['movie','show'].includes(type)){
        return res.status(400).json({ items: [], message: 'Missing or invalid type/id' });
      }
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const size = Math.min(50, Math.max(1, parseInt(req.query.size || '10', 10)));
      const q = { item_type: type, item_id: id, deleted: { $ne: true } };
      const [itemsRaw, total, stats] = await Promise.all([
        Review.find(q).sort({ created_at: -1 }).skip((page-1)*size).limit(size).lean(),
        Review.countDocuments(q),
        Review.aggregate([
          { $match: q },
          { $group: { _id: null, avg: { $avg: '$stars' }, count: { $sum: 1 } } }
        ])
      ]);
      const items = await enrichReviews(itemsRaw, req.user);
      const avg = (stats && stats[0] && stats[0].avg) ? Number(stats[0].avg) : 0;
      const count = (stats && stats[0] && stats[0].count) ? Number(stats[0].count) : 0;
      res.json({ items, page, size, total, average: avg, count });
    } catch (e){
      res.status(500).json({ items: [], page: 1, size: 10, total: 0, average: 0, count: 0 });
    }
  });

  // Get one review by id (with enriched comments)
  server.get('/api/v1/reviews/:id', async (req, res) => {
    try {
      const id = String(req.params.id||'');
      const r = await Review.findById(id).lean();
      if (!r || r.deleted) return res.status(404).json({ review: null });
      const [er] = await enrichReviews([r], req.user);
      try {
        const comments = Array.isArray(er.comments) ? er.comments : [];
        const ids = comments.map(c => c.user_id).filter(Boolean).map(String);
        const uniq = Array.from(new Set(ids));
        let users = [];
        if (uniq.length){
          users = await User.find({ _id: { $in: uniq } })
            .select('_id local.username profile.custom_url profile.profile_image')
            .lean();
        }
        const map = new Map(users.map(u => [String(u._id), u]));
        const me = req.user && String(req.user._id);
        er.comments = comments.map(c => {
          const u = c.user_id ? map.get(String(c.user_id)) : null;
          const username = (u && u.local && u.local.username) || c.username || '';
          const slug = u && u.profile && u.profile.custom_url;
          const img = (u && u.profile && u.profile.profile_image && u.profile.profile_image !== 'profile-picture-missing.png')
            ? `/static/style/img/profile_images/users/${u._id}/${u.profile.profile_image}`
            : '/static/style/img/standard/standard_avatar.png';
          const link = slug ? `/${slug}` : (u ? `/${u._id}` : '#');
          const upvote_count = Array.isArray(c.upvotes) ? c.upvotes.length : 0;
          const downvote_count = Array.isArray(c.downvotes) ? c.downvotes.length : 0;
          const user_vote = (me && Array.isArray(c.upvotes) && c.upvotes.map(String).includes(me)) ? 'up' : ((me && Array.isArray(c.downvotes) && c.downvotes.map(String).includes(me)) ? 'down' : null);
          return Object.assign({}, c, { username, user_link: link, user_avatar: img, upvote_count, downvote_count, user_vote });
        });
      } catch(_){}
      res.json({ review: er });
    } catch (e){
      res.status(404).json({ review: null });
    }
  });

  // Create or replace a user's review for an item
  server.post('/api/v1/reviews', apiIsCorrectUser, async (req, res) => {
    try {
      const user = req.user;
      const type = String(req.body.type||'').toLowerCase();
      const itemId = String(req.body.id||'');
      const title = String(req.body.title||'').trim();
      let stars = Number(req.body.stars||0);
      let text = String(req.body.text||'').trim();
      if (!['movie','show'].includes(type)) return res.status(400).json({ ok: false, message: 'Invalid type' });
      if (!itemId) return res.status(400).json({ ok: false, message: 'Missing id' });
      if (!title) return res.status(400).json({ ok: false, message: 'Missing title' });
      if (isNaN(stars)) stars = 0;
      stars = Math.max(0, Math.min(5, Math.round(stars*2)/2));
      const maxLen = await getNumericSetting('review_max_length', 500);
      if (text.length > maxLen) return res.status(400).json({ ok:false, message: `Review text exceeds ${maxLen} characters` });
      const username = (user && user.local && user.local.username) || '';

      // Upsert: one review per user per item
      const existing = await Review.findOne({ item_type: type, item_id: itemId, author_id: user._id }).exec();
      if (existing){
        existing.title = title;
        existing.text = text;
        existing.stars = stars;
        existing.updated_at = new Date();
        existing.deleted = false;
        existing.author_username = username;
        // Ensure author has upvoted their own review
        try {
          const sid = String(user._id);
          if (!existing.upvotes.map(String).includes(sid)) existing.upvotes.push(user._id);
          // remove any accidental self-downvote
          existing.downvotes = (existing.downvotes||[]).filter(v => String(v) !== sid);
        } catch(_){}
        await existing.save();
        return res.json({ ok: true, id: existing._id });
      }
      const created = await Review.create({
        item_type: type,
        item_id: itemId,
        title,
        text,
        stars,
        author_id: user._id,
        author_username: username,
        upvotes: [ user._id ]
      });
      res.json({ ok: true, id: created._id });
    } catch (e){
      res.status(500).json({ ok: false });
    }
  });

  // Vote up/down/clear on a review
  server.post('/api/v1/reviews/:id/vote', apiIsCorrectUser, async (req, res) => {
    try {
      const userId = String(req.body.user_id);
      const action = String(req.body.vote||'none'); // 'up' | 'down' | 'none'
      const id = String(req.params.id||'');
      const r = await Review.findById(id);
      if (!r || r.deleted) return res.status(404).json({ ok: false });
      const u = require('mongoose').Types.ObjectId(userId);
      r.upvotes = (r.upvotes||[]).filter(v => String(v) !== userId);
      r.downvotes = (r.downvotes||[]).filter(v => String(v) !== userId);
      if (action === 'up') r.upvotes.push(u);
      if (action === 'down') r.downvotes.push(u);
      await r.save();
      res.json({ ok: true, up: r.upvotes.length, down: r.downvotes.length, vote: action === 'none' ? null : action });
    } catch (e){
      res.status(500).json({ ok: false });
    }
  });

  // Add a comment to a review (flat + replies via parent_id)
  server.post('/api/v1/reviews/:id/comment', apiIsCorrectUser, async (req, res) => {
    try {
      const id = String(req.params.id||'');
      const msg = String(req.body.message||'').trim();
      const parent = req.body.parent_id ? String(req.body.parent_id) : null;
      if (!msg) return res.status(400).json({ ok: false, message: 'Empty message' });
      const r = await Review.findById(id);
      if (!r || r.deleted) return res.status(404).json({ ok: false });
      const user = req.user;
      const username = (user && user.local && user.local.username) || '';
      const created = {
        _id: require('mongoose').Types.ObjectId(),
        user_id: user._id,
        username,
        message: msg,
        created_at: new Date(),
        edited_at: null,
        deleted: false,
        parent_id: parent ? require('mongoose').Types.ObjectId(parent) : null,
        upvotes: [],
        downvotes: []
      };
      r.comments.push(created);
      await r.save();
      res.json({ ok: true, comment_id: created._id });
    } catch (e){
      res.status(500).json({ ok: false });
    }
  });

  // Reply to a comment (1-level nesting support via parent_id)
  server.post('/api/v1/reviews/:id/comment/:comment_id/reply', apiIsCorrectUser, async (req, res) => {
    try {
      const reviewId = String(req.params.id||'');
      const parentId = String(req.params.comment_id||'');
      const msg = String(req.body.message||'').trim();
      if (!msg) return res.status(400).json({ ok:false });
      const r = await Review.findById(reviewId);
      if (!r || r.deleted) return res.status(404).json({ ok:false });
      const hasParent = (r.comments||[]).some(c => String(c._id) === parentId);
      if (!hasParent) return res.status(400).json({ ok:false });
      const user = req.user; const username = (user && user.local && user.local.username) || '';
      const created = {
        _id: require('mongoose').Types.ObjectId(),
        user_id: user._id,
        username,
        message: msg,
        created_at: new Date(),
        edited_at: null,
        deleted: false,
        parent_id: require('mongoose').Types.ObjectId(parentId),
        upvotes: [],
        downvotes: []
      };
      r.comments.push(created);
      await r.save();
      res.json({ ok:true, comment_id: created._id });
    } catch (e){ res.status(500).json({ ok:false }); }
  });

  // Edit a comment (author or admin)
  server.post('/api/v1/reviews/:id/comment/:comment_id/edit', apiIsCorrectUser, async (req, res) => {
    try {
      const r = await Review.findById(String(req.params.id||''));
      if (!r || r.deleted) return res.status(404).json({ ok:false });
      const cid = String(req.params.comment_id||'');
      const msg = String(req.body.message||'').trim();
      const isAdmin = !!(req.user && req.user.permissions && req.user.permissions.level && req.user.permissions.level.admin);
      let found = null;
      (r.comments||[]).forEach(c => { if (String(c._id)===cid) found = c; });
      if (!found) return res.status(404).json({ ok:false });
      if (!isAdmin && String(found.user_id) !== String(req.body.user_id)) return res.status(403).json({ ok:false });
      if (!msg) return res.status(400).json({ ok:false });
      found.message = msg; found.edited_at = new Date();
      await r.save();
      res.json({ ok:true });
    } catch(e){ res.status(500).json({ ok:false }); }
  });

  // Delete a comment (soft or hard). Admin can hard-delete; author can soft-delete.
  server.post('/api/v1/reviews/:id/comment/:comment_id/delete', apiIsCorrectUser, async (req, res) => {
    try {
      const r = await Review.findById(String(req.params.id||''));
      if (!r || r.deleted) return res.status(404).json({ ok:false });
      const cid = String(req.params.comment_id||'');
      const mode = String(req.body.mode||'soft');
      const isAdmin = !!(req.user && req.user.permissions && req.user.permissions.level && req.user.permissions.level.admin);
      if (mode === 'hard' && !isAdmin) return res.status(403).json({ ok:false });
      let idx = -1; (r.comments||[]).forEach((c,i)=>{ if (String(c._id)===cid) idx=i; });
      if (idx < 0) return res.status(404).json({ ok:false });
      const c = r.comments[idx];
      if (!isAdmin && String(c.user_id) !== String(req.body.user_id)) return res.status(403).json({ ok:false });
      if (mode === 'hard') { r.comments.splice(idx,1); }
      else { c.deleted = true; }
      await r.save();
      res.json({ ok:true });
    } catch(e){ res.status(500).json({ ok:false }); }
  });

  // Vote on a comment
  server.post('/api/v1/reviews/:id/comment/:comment_id/vote', apiIsCorrectUser, async (req, res) => {
    try {
      const r = await Review.findById(String(req.params.id||''));
      if (!r || r.deleted) return res.status(404).json({ ok:false });
      const cid = String(req.params.comment_id||'');
      const action = String(req.body.vote||'none');
      let found = null;
      (r.comments||[]).forEach(c => { if (String(c._id)===cid) found=c; });
      if (!found) return res.status(404).json({ ok:false });
      const uid = String(req.body.user_id||'');
      found.upvotes = (found.upvotes||[]).filter(v => String(v) !== uid);
      found.downvotes = (found.downvotes||[]).filter(v => String(v) !== uid);
      if (action === 'up') found.upvotes.push(require('mongoose').Types.ObjectId(uid));
      if (action === 'down') found.downvotes.push(require('mongoose').Types.ObjectId(uid));
      await r.save();
      res.json({ ok:true, up: (found.upvotes||[]).length, down: (found.downvotes||[]).length, vote: action==='none'?null:action });
    } catch(e){ res.status(500).json({ ok:false }); }
  });

  // Edit or delete own review
  server.post('/api/v1/reviews/:id/edit', apiIsCorrectUser, async (req, res) => {
    try {
      const id = String(req.params.id||'');
      const r = await Review.findById(id);
      if (!r) return res.status(404).json({ ok: false });
      if (String(r.author_id) !== String(req.body.user_id)) return res.status(403).json({ ok:false });
      const patch = {};
      if (typeof req.body.title === 'string') patch.title = String(req.body.title).trim();
      if (typeof req.body.text === 'string') {
        let txt = String(req.body.text).trim();
        const maxLen = await getNumericSetting('review_max_length', 500);
        if (txt.length > maxLen) return res.status(400).json({ ok:false, message: `Review text exceeds ${maxLen} characters` });
        patch.text = txt;
      }
      if (typeof req.body.stars !== 'undefined') {
        let s = Number(req.body.stars||0); s = Math.max(0, Math.min(5, Math.round(s*2)/2)); patch.stars = s;
      }
      Object.assign(r, patch);
      r.updated_at = new Date();
      await r.save();
      res.json({ ok: true });
    } catch (e){
      res.status(500).json({ ok: false });
    }
  });

  server.post('/api/v1/reviews/:id/delete', apiIsCorrectUser, async (req, res) => {
    try {
      const id = String(req.params.id||'');
      const r = await Review.findById(id);
      if (!r) return res.status(404).json({ ok: false });
      const isAdmin = !!(req.user && req.user.permissions && req.user.permissions.level && req.user.permissions.level.admin);
      if (!isAdmin && String(r.author_id) !== String(req.body.user_id)) return res.status(403).json({ ok:false });
      r.deleted = true;
      await r.save();
      res.json({ ok: true });
    } catch (e){
      res.status(500).json({ ok: false });
    }
  });
}
