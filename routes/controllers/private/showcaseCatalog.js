const isLoggedIn = require('../../middleware/isLoggedIn');
const ShowcaseCatalog = require('../../../db/models/showcaseCatalog');

const templatePath = 'private assets/template.ejs';

function parseIntSafe(v, d){ const n = parseInt(v, 10); return isFinite(n) ? n : d; }

module.exports = (server) => {
  console.log('* Admin Showcase Catalog Routes Loaded Into Server');

  // List + inline edit
  server.get('/admin/showcase-catalog', isLoggedIn, async (req, res) => {
    try {
      const items = await ShowcaseCatalog.find({}).sort({ slug: 1 }).lean();
      const msg = (req.query && req.query.msg) || null;
      const err = (req.query && req.query.err) || null;
      res.render(templatePath, {
        page_title: 'iWatched - Admin Showcase Catalog',
        page_file: 'showcase_catalog',
        page_data: { items, msg, err },
        user: req.user
      });
    } catch (e) {
      res.render(templatePath, {
        page_title: 'iWatched - Admin Showcase Catalog',
        page_file: 'showcase_catalog',
        page_data: { items: [], err: 'Failed to load' },
        user: req.user
      });
    }
  });

  // Update an entry
  server.post('/admin/showcase-catalog/:id([0-9a-fA-F]{24})', isLoggedIn, async (req, res) => {
    const id = req.params.id;
    try {
      const item = await ShowcaseCatalog.findById(id);
      if (!item) return res.redirect('/admin/showcase-catalog?err=not_found');

      // Only allow editing mutable fields (slug stays as-is)
      item.title = (req.body.title || item.title).toString().trim();
      item.description = (req.body.description || '').toString();
      const tier = (req.body.tier || item.tier).toString().toLowerCase();
      item.tier = (tier === 'premium') ? 'premium' : 'free';
      item.icon = (req.body.icon || '').toString().trim() || null;
      item.max_instances = parseIntSafe(req.body.max_instances, item.max_instances || 1);
      item.active = (req.body.active === 'on' || req.body.active === '1' || req.body.active === 'true');

      // Optional config_schema JSON
      if (typeof req.body.config_schema_json !== 'undefined'){
        try {
          const raw = (req.body.config_schema_json || '').toString().trim();
          const parsed = raw ? JSON.parse(raw) : {};
          if (parsed && typeof parsed === 'object') item.config_schema = parsed;
        } catch (e) {
          return res.redirect('/admin/showcase-catalog?err=invalid_schema');
        }
      }

      await item.save();
      return res.redirect('/admin/showcase-catalog?msg=saved');
    } catch (e) {
      return res.redirect('/admin/showcase-catalog?err=save_failed');
    }
  });

  // Toggle active (enable/disable)
  server.post('/admin/showcase-catalog/:id([0-9a-fA-F]{24})/toggle', isLoggedIn, async (req, res) => {
    try {
      const item = await ShowcaseCatalog.findById(req.params.id);
      if (!item) return res.redirect('/admin/showcase-catalog?err=not_found');
      item.active = !item.active;
      await item.save();
      return res.redirect('/admin/showcase-catalog?msg=toggled');
    } catch (_) {
      return res.redirect('/admin/showcase-catalog?err=toggle_failed');
    }
  });
}

