const User = require('../../../../db/models/user');
const Badge = require('../../../../db/models/badge');

module.exports = (server) => {
  console.log('* UserBadges API Routes Loaded Into Server');

  // Return the list of badges a user owns with icon/title, for pickers
  server.get('/api/v1/user-badges/:profile_id', async (req, res) => {
    try {
      const id = String(req.params.profile_id||'');
      const user = await User.findById(id).select('profile.user_badges').lean();
      if (!user) return res.status(404).send({ ok:false, message:'User not found' });
      const owned = Array.isArray(user.profile && user.profile.user_badges) ? (user.profile.user_badges||[]) : [];
      const ids = Array.from(new Set(owned.map(b => String(b.badge_id)).filter(Boolean)));
      let meta = [];
      if (ids.length){
        const docs = await Badge.find({ _id: { $in: ids } }).select('_id title icon').lean();
        const map = new Map((docs||[]).map(d => [String(d._id), d]));
        meta = owned.map(b => {
          const d = map.get(String(b.badge_id));
          if (!d) return null;
          return { id: String(d._id), title: d.title||'', icon: d.icon ? ('/static/style/img/badges/' + d.icon) : null, awarded_at: b.awarded_at || null };
        }).filter(Boolean);
      }
      return res.send({ ok:true, items: meta });
    } catch (e) {
      return res.status(500).send({ ok:false });
    }
  });
};

