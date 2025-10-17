const isLoggedIn = require('../../middleware/isLoggedIn');

module.exports = (server) => {
  const templatePath = 'private assets/template.ejs';
  server.get('/admin/reports', isLoggedIn, (req, res) => {
    res.render(templatePath, {
      page_title: 'iWatched - Admin / Reports',
      page_file: 'reports',
      page_data: {},
      user: req.user
    });
  });
}

