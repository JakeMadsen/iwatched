const isLoggedIn = require('../../middleware/isLoggedIn');
const ContactMessage = require('../../../db/models/contactMessages');
const User = require('../../../db/models/user');

module.exports = (server) => {
  const templatePath = 'private assets/template.ejs';

  server.get('/admin/contact', isLoggedIn, async (req, res) => {
    const messages = await ContactMessage.find({}).sort({ _id: -1 }).limit(100).lean();
    // enrich with user names if possible
    const enriched = await Promise.all(messages.map(async m => {
      let fromUser = null;
      try { fromUser = await User.findById(m.from).lean(); } catch (_) {}
      return {
        _id: m._id,
        title: m.title,
        type: m.type,
        text: m.text,
        email: m.email,
        from: m.from,
        from_username: fromUser && fromUser.local ? fromUser.local.username : null,
        from_slug: fromUser && fromUser.profile ? fromUser.profile.custom_url : null
      };
    }));

    res.render(templatePath, {
      page_title: 'iWatched - Admin / Contact',
      page_file: 'contact',
      page_data: { messages: enriched },
      user: req.user
    });
  });
}

