const isLoggedIn = require('../../middleware/isLoggedIn');

module.exports = (server) => {
  console.log('* Admin Api-Metrics Routes Loaded');

  server.get('/admin/api-metrics', isLoggedIn, async (req, res) => {
    try {
      const metrics = require('../../../bin/server/metrics');
      const mongoose = require('mongoose');
      const snap = metrics.snapshot(mongoose);
      const endpoints = metrics.snapshotEndpoints([
        '/api/v1/user', '/api/v1/users', '/api/v1/user-movies', '/api/v1/user-shows', '/api/v1/movies', '/api/v1/shows'
      ]);
      return res.render('private assets/template.ejs', {
        page_title: 'iWatched - API Metrics',
        page_file: 'api_metrics',
        page_data: { snapshot: snap, endpoints: endpoints },
        user: req.user
      });
    } catch (e) {
      return res.render('private assets/template.ejs', {
        page_title: 'iWatched - API Metrics',
        page_file: 'api_metrics',
        page_data: { snapshot: {}, endpoints: [] },
        user: req.user
      });
    }
  });

  server.get('/admin/api-metrics.json', isLoggedIn, async (req, res) => {
    try {
      const metrics = require('../../../bin/server/metrics');
      const mongoose = require('mongoose');
      const snap = metrics.snapshot(mongoose);
      const endpoints = metrics.snapshotEndpoints([
        '/api/v1/user', '/api/v1/users', '/api/v1/user-movies', '/api/v1/user-shows', '/api/v1/movies', '/api/v1/shows'
      ]);
      res.json({ ok: true, snapshot: snap, endpoints });
    } catch (e) {
      res.json({ ok: false });
    }
  });
}

