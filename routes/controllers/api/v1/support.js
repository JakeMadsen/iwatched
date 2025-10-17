const Support = require('../../../../db/models/supportMessages');

module.exports = function(server){
  // Get unseen support replies for a user
  server.get('/api/v1/support/notifications/:user_id', async (req, res) => {
    try {
      const userId = req.params.user_id;
      const items = await Support.find({ opened_by: userId, seen_by_user: false, resolved: false })
        .sort({ last_updated: -1 })
        .limit(10)
        .lean();
      const notifications = items.map(it => ({
        id: String(it._id),
        title: it.title || 'Support update',
        last_updated: it.last_updated,
      }));
      res.json({ notifications });
    } catch (e) {
      res.json({ notifications: [] });
    }
  });

  // Mark a support case as seen by the user
  server.post('/api/v1/support/notifications/mark', async (req, res) => {
    try {
      const caseId = req.body && req.body.case_id;
      if (!caseId) return res.status(400).json({ ok: false });
      const doc = await Support.findOne({ _id: caseId });
      if (!doc) return res.json({ ok: true });
      doc.seen_by_user = true;
      await doc.save();
      res.json({ ok: true });
    } catch (e) {
      res.json({ ok: false });
    }
  });
}
