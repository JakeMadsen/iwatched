const isLoggedIn = require('../../middleware/isLoggedIn');

module.exports = (server) => {
  server.get('/admin/announcements', isLoggedIn, (req, res) => {
    if(!(req.user && req.user.permissions && req.user.permissions.level && req.user.permissions.level.admin)){
      return res.redirect('/admin');
    }
    res.render('private assets/template.ejs', {
      page_title: 'iWatched - Admin - Announcements',
      page_file: 'announcements_admin',
      page_data: { edit_id: req.query && req.query.edit || '' },
      user: req.user
    });
  });
}
