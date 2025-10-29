const isLoggedIn = require('../../middleware/isLoggedIn');
const ContactMessage = require('../../../db/models/contactMessages');
const User = require('../../../db/models/user');

module.exports = (server) => {
  const templatePath = 'private assets/template.ejs';

  server.get('/admin/contact', isLoggedIn, async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const per = Math.min(100, Math.max(5, parseInt(req.query.per || '20', 10) || 20));
    const status = String(req.query.status || 'all'); // 'all' | 'spam' | 'clean'
    const sortKey = String(req.query.sort || 'new');  // 'new' | 'old' | 'title' | 'type' | 'email' | 'status'

    const query = {};
    if (status === 'spam') query.is_spam = true;
    else if (status === 'clean') query.is_spam = { $ne: true };

    const sort = (() => {
      switch (sortKey) {
        case 'old': return { created_at: 1 };
        case 'title': return { title: 1, _id: -1 };
        case 'type': return { type: 1, _id: -1 };
        case 'email': return { email: 1, _id: -1 };
        case 'status': return { is_spam: -1, created_at: -1 };
        default: return { created_at: -1 };
      }
    })();

    const total = await ContactMessage.countDocuments(query);
    const messages = await ContactMessage.find(query).sort(sort).skip((page - 1) * per).limit(per).lean();
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
        created_at: m.created_at || null,
        is_spam: !!m.is_spam,
        spam_reason: m.spam_reason || null,
        from_username: fromUser && fromUser.local ? fromUser.local.username : null,
        from_slug: fromUser && fromUser.profile ? fromUser.profile.custom_url : null,
        ip: m.ip || null,
        ua: m.ua || null
      };
    }));

    res.render(templatePath, {
      page_title: 'iWatched - Admin / Contact',
      page_file: 'contact',
      page_data: { messages: enriched, total, page, per, sort: sortKey, status },
      user: req.user
    });
  });

  server.post('/admin/contact/:id/delete', isLoggedIn, async (req, res) => {
    try { await ContactMessage.deleteOne({ _id: req.params.id }); } catch (_) {}
    const q = [];
    if (req.query.page) q.push('page=' + encodeURIComponent(req.query.page));
    if (req.query.per) q.push('per=' + encodeURIComponent(req.query.per));
    if (req.query.sort) q.push('sort=' + encodeURIComponent(req.query.sort));
    if (req.query.status) q.push('status=' + encodeURIComponent(req.query.status));
    res.redirect('/admin/contact' + (q.length ? ('?' + q.join('&')) : ''));
  });
}
