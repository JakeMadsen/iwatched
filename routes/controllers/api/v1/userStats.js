const userStatsService = require('../../../services/userStats');

module.exports = (server) => {
  console.log('* UserStats Routes Loaded Into Server');

  // Public-ish stats endpoint. Respects profile visibility via the
  // standard profile route middleware; here we expose aggregate,
  // non-personal metrics suitable for bots/integrations.
  server.get('/api/v1/user-stats/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { user, stats } = await userStatsService.getOrBuildUserStats(id);
      if (!user) return res.status(404).json({ ok:false, code:'not_found' });

      // For now, we mirror profile visibility lightly: private profiles
      // only expose stats to the owner (by session user id).
      try {
        const isPrivate = !!(user.profile && (user.profile.visibility === 'private' || user.profile.private));
        if (isPrivate) {
          const viewer = req.user;
          if (!viewer || String(viewer._id) !== String(user._id)) {
            return res.status(403).json({ ok:false, code:'forbidden' });
          }
        }
      } catch (_) {}

      return res.json({ ok:true, stats });
    } catch (e) {
      console.error('user-stats error:', e);
      return res.status(500).json({ ok:false, code:'stats_error' });
    }
  });
};

