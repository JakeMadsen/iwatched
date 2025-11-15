const isLoggedIn = require('../../middleware/isLoggedIn');
const SiteSetting = require('../../../db/models/siteSetting');
const templatePath = 'private assets/template.ejs';

module.exports = (server) => {
  console.log('* siteSettings Routes Loaded Into Server');

  const knownSettings = [
    {
      key: 'review_max_length',
      type: 'number',
      label: 'Review max length (characters)',
      min: 100,
      max: 4000,
      defaultValue: 500,
      help: 'Maximum number of characters allowed for a single review. Used by the Reviews API.'
    },
    {
      key: 'showcase_note_max_length',
      type: 'number',
      label: 'Showcase note max length (characters)',
      min: 50,
      max: 2000,
      defaultValue: 300,
      help: 'Maximum characters for short notes on profile showcases.'
    },
    {
      key: 'showcase_text_max_length',
      type: 'number',
      label: 'Showcase text max length (characters)',
      min: 100,
      max: 4000,
      defaultValue: 1000,
      help: 'Maximum characters for long text or descriptions in showcases.'
    }
  ];

  function normalizeNumber(raw, cfg) {
    let n = Number(raw);
    if (!isFinite(n) || n <= 0) n = cfg.defaultValue;
    if (typeof cfg.min === 'number' && n < cfg.min) n = cfg.min;
    if (typeof cfg.max === 'number' && n > cfg.max) n = cfg.max;
    return Math.floor(n);
  }

  server.get('/admin/site-settings', isLoggedIn, async (req, res) => {
    try {
      const keys = knownSettings.map(s => s.key);
      const existing = await SiteSetting.find({ key: { $in: keys } }).lean();
      const map = new Map(existing.map(d => [d.key, d]));

      const settings = knownSettings.map(cfg => {
        const doc = map.get(cfg.key);
        let current = doc && typeof doc.value !== 'undefined' && doc.value !== null
          ? doc.value
          : cfg.defaultValue;
        if (cfg.type === 'number') {
          current = normalizeNumber(current, cfg);
        }
        return Object.assign({}, cfg, { current });
      });

      res.render(templatePath, {
        page_title: 'iWatched - Admin / Site Settings',
        page_file: 'site_settings',
        page_data: {
          settings,
          message: req.query.saved ? 'Settings updated successfully.' : null
        },
        user: req.user
      });
    } catch (e) {
      res.render(templatePath, {
        page_title: 'iWatched - Admin / Site Settings',
        page_file: 'site_settings',
        page_data: {
          settings: knownSettings.map(cfg => Object.assign({}, cfg, { current: cfg.defaultValue })),
          message: 'Failed to load settings. Showing defaults.'
        },
        user: req.user
      });
    }
  });

  server.post('/admin/site-settings', isLoggedIn, async (req, res) => {
    try {
      const updates = [];
      knownSettings.forEach(cfg => {
        const raw = req.body && Object.prototype.hasOwnProperty.call(req.body, cfg.key)
          ? req.body[cfg.key]
          : undefined;
        if (typeof raw === 'undefined') return;
        if (cfg.type === 'number') {
          const value = normalizeNumber(raw, cfg);
          updates.push({ key: cfg.key, value });
        } else {
          updates.push({ key: cfg.key, value: String(raw || '') });
        }
      });

      if (updates.length) {
        await Promise.all(
          updates.map(u => SiteSetting.findOneAndUpdate(
            { key: u.key },
            { $set: { value: u.value } },
            { upsert: true, new: true }
          ))
        );
      }

      res.redirect('/admin/site-settings?saved=1');
    } catch (e) {
      res.redirect('/admin/site-settings');
    }
  });
};

