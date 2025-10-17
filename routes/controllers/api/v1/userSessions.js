const { listUserSessions, revokeSession, revokeOtherSessions } = require('../../../services/sessions');

module.exports = (server) => {
  console.log('* User Session Routes Loaded Into Server');

  server.get('/api/v1/user/sessions', async (req, res) => {
    try {
      if (!req.user) return res.status(401).send({ status: 401, message: 'Unauthorized' });
      const sessions = await listUserSessions(req.user._id, req.sessionID);
      const plan = (req.user.account && req.user.account.plan) || 'free';
      res.send({ status: 200, plan, current_sid: req.sessionID, sessions });
    } catch (e) {
      res.status(500).send({ status: 500, message: 'Failed to list sessions' });
    }
  });

  server.post('/api/v1/user/sessions/revoke', async (req, res) => {
    try {
      if (!req.user) return res.status(401).send({ status: 401, message: 'Unauthorized' });
      const sid = (req.body && req.body.sid) || '';
      if (!sid) return res.status(400).send({ status: 400, message: 'Missing sid' });
      if (String(sid) === String(req.sessionID)) return res.status(400).send({ status: 400, message: 'Cannot revoke current session' });
      await revokeSession(req.user._id, sid);
      res.send({ status: 200 });
    } catch (e) {
      res.status(500).send({ status: 500, message: 'Failed to revoke session' });
    }
  });

  server.post('/api/v1/user/sessions/revoke_others', async (req, res) => {
    try {
      if (!req.user) return res.status(401).send({ status: 401, message: 'Unauthorized' });
      await revokeOtherSessions(req.user._id, req.sessionID);
      res.send({ status: 200 });
    } catch (e) {
      res.status(500).send({ status: 500, message: 'Failed to revoke other sessions' });
    }
  });
}

