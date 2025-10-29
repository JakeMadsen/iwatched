const isLoggedIn = require('../../middleware/isLoggedIn');

module.exports = (server) => {
  const templatePath = 'private assets/template.ejs';

  // Admins and Roles (visual only)
  server.get('/admin/admins', isLoggedIn, async (req, res) => {
    const sampleRoles = [
      { name: 'Owner', permissions: ['all'] },
      { name: 'Moderator', permissions: ['view_users','manage_support','moderate_uploads','manage_reports'] },
      { name: 'Support', permissions: ['view_support','reply_support'] }
    ];
    const sampleAdmins = [
      { id: 'u1', username: 'TheDane', role: 'Owner' },
      { id: 'u2', username: 'ModOne', role: 'Moderator' },
      { id: 'u3', username: 'Helper', role: 'Support' }
    ];
    res.render(templatePath, {
      page_title: 'iWatched - Admin / Admins',
      page_file: 'admins',
      page_data: { roles: sampleRoles, admins: sampleAdmins },
      user: req.user
    });
  });

  // Admin audit (visual placeholder)
  server.get('/admin/audit', isLoggedIn, async (req, res) => {
    const now = new Date();
    const sample = [
      { at: new Date(now - 2*60*1000), actor: 'TheDane', persona: 'JakeTheDane', action: 'users.ban', target: 'user:123', meta: 'reason: spam' },
      { at: new Date(now - 10*60*1000), actor: 'ModOne', persona: 'ModOne', action: 'support.reply', target: 'case:abc', meta: 'OK' },
      { at: new Date(now - 30*60*1000), actor: 'Helper', persona: 'Helper', action: 'uploads.delete', target: 'banner_456.webp', meta: 'by report' }
    ];
    res.render(templatePath, {
      page_title: 'iWatched - Admin / Audit',
      page_file: 'audit',
      page_data: { events: sample },
      user: req.user
    });
  });
}

