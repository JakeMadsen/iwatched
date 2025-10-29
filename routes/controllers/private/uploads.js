const isLoggedIn = require('../../middleware/isLoggedIn');

module.exports = (server) => {
  const templatePath = 'private assets/template.ejs';
  let storage = null; try { storage = require('../../../bin/server/config/storage'); } catch (_) { storage = null; }
  const User = require('../../../db/models/user');

  server.get('/admin/uploads', isLoggedIn, async (req, res) => {
    const useS3 = !!(storage && storage.isEnabled && storage.isEnabled());
    let items = [];
    try {
      if (useS3) {
        const list = await storage.list('style/img/profile_images/users/', 300);
        items = (list || []).map(o => {
          const key = String(o.key || '');
          const parts = key.split('/');
          const userId = parts[parts.length - 2] || null;
          const file = parts[parts.length - 1] || null;
          const type = /^picture_/i.test(file||'') ? 'avatar' : (/^banner_/i.test(file||'') ? 'banner' : 'other');
          return {
            key, userId, file, type,
            url: `/static/style/img/profile_images/users/${userId}/${file}`,
            size: o.size, lastModified: o.lastModified
          };
        }).sort((a,b)=> new Date(b.lastModified) - new Date(a.lastModified));
      } else {
        // Fallback: local FS listing
        const fs = require('fs'); const path = require('path');
        const base = path.join(__dirname, '../../../public/style/img/profile_images/users');
        if (fs.existsSync(base)){
          const uids = fs.readdirSync(base).filter(d => fs.statSync(path.join(base,d)).isDirectory());
          uids.forEach(uid => {
            fs.readdirSync(path.join(base, uid)).forEach(f => {
              const p = path.join(base, uid, f); const st = fs.statSync(p);
              items.push({ key: `style/img/profile_images/users/${uid}/${f}`, userId: uid, file: f, type: /^picture_/i.test(f)?'avatar':(/^banner_/i.test(f)?'banner':'other'), url: `/static/style/img/profile_images/users/${uid}/${f}`, size: st.size, lastModified: st.mtime });
            });
          });
          items.sort((a,b)=> new Date(b.lastModified) - new Date(a.lastModified));
        }
      }
    } catch (e) { items = []; }

    res.render(templatePath, {
      page_title: 'iWatched - Admin / Uploads',
      page_file: 'uploads_moderation',
      page_data: { items },
      user: req.user
    });
  });

  // Simple delete (functional): remove object and clear user.profile if matches
  server.post('/admin/uploads/:uid/:file/delete', isLoggedIn, async (req, res) => {
    const uid = req.params.uid; const file = req.params.file;
    const key = `style/img/profile_images/users/${uid}/${file}`;
    try { if (storage && storage.deleteObject) await storage.deleteObject(key); } catch(_){}
    try {
      const u = await User.findById(uid);
      if (u && u.profile){
        const isAvatar = /^picture_/i.test(file||'');
        const isBanner = /^banner_/i.test(file||'');
        if (isAvatar && u.profile.profile_image === file) u.profile.profile_image = null;
        if (isBanner && u.profile.banner_image === file) u.profile.banner_image = null;
        try { if (isAvatar || isBanner) await u.save(); } catch(_){}
      }
    } catch(_){}
    res.redirect('/admin/uploads');
  });
}

