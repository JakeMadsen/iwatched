const isLoggedIn = require('../../middleware/isLoggedIn');
const path = require('path');
const fs = require('fs');
const ModeratorPersona = require('../../../db/models/moderatorPersona');
const User = require('../../../db/models/user');

function ensureDirSync(dir){ try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {} }
function sanitizeFilename(name){ return String(name||'').toLowerCase().replace(/[^a-z0-9-_\.]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,''); }

module.exports = (server) => {
  console.log('* Moderator Persona Routes Loaded Into Server');

  server.get('/admin/personas', isLoggedIn, async (req, res) => {
    const personas = await ModeratorPersona.find({}).sort({ created_at: -1 }).lean();
    const users = await User.find({ 'permissions.level.admin': true }).select('_id local.username').lean();
    res.render('private assets/template.ejs', {
      page_title: 'iWatched - Moderator Personas',
      page_file: 'personas',
      page_data: { personas, users, ok: req.query.ok },
      user: req.user
    });
  });

  server.post('/admin/personas', isLoggedIn, async (req, res) => {
    try {
      const name = (req.body.name||'').trim();
      const assigned_user_id = req.body.assigned_user_id || null;
      if (!name) return res.redirect('/admin/personas');
      const p = new ModeratorPersona({ name, assigned_user_id: assigned_user_id || null });
      await p.save();
      const file = (req.files && (req.files.avatar || req.files.icon)) || null;
      if (file) {
        const ext = path.extname(file.name||'.png').toLowerCase() || '.png';
        const base = sanitizeFilename(`${p._id}-${name}`)+ext;
        const dir = path.join(__dirname, '../../../public/style/img/personas');
        ensureDirSync(dir);
        await file.mv(path.join(dir, base));
        p.avatar = base;
        await p.save();
      }
      res.redirect('/admin/personas?ok=1');
    } catch (e) { res.redirect('/admin/personas'); }
  });

  server.post('/admin/personas/:id([0-9a-fA-F]{24})/delete', isLoggedIn, async (req, res) => {
    try {
      const p = await ModeratorPersona.findById(req.params.id);
      if (p) {
        if (p.avatar) {
          const dir = path.join(__dirname, '../../../public/style/img/personas');
          try { fs.unlinkSync(path.join(dir, p.avatar)); } catch (_) {}
        }
        await p.remove();
      }
    } catch (_) {}
    res.redirect('/admin/personas');
  });
}

