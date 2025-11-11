const User = require('../../../../db/models/user');
const ShowcaseCatalog = require('../../../../db/models/showcaseCatalog');
const UserShowcase = require('../../../../db/models/userShowcase');
const apiIsCorrectUser = require('../../../middleware/apiIsCorrectUser');

async function ensureCatalogSeed(){
  // Seed the Recent Timeline showcase if catalog is empty/missing
  try {
    const count = await ShowcaseCatalog.countDocuments({}).catch(()=>0);
    if (count && count > 0) return;
  } catch(_) {}
  try {
    const exists = await ShowcaseCatalog.findOne({ slug: 'recent_timeline' }).lean();
    if (!exists){
      const doc = new ShowcaseCatalog({
        slug: 'recent_timeline',
        title: 'Recent Timeline',
        description: 'Show a grid of your most recent activity: watched, saved, or favourited movies and shows. Configure to show only movies, only shows, mixed, or favourited only.',
        tier: 'free',
        icon: null,
        max_instances: 3,
        config_schema: { mode: { type: 'enum', values: ['mixed','movies_only','shows_only'], default: 'mixed' }, count: { type:'enum', values:[6,12], default:12 } },
        active: true
      });
      await doc.save();
    }
    // Favorite Person
    const favPerson = await ShowcaseCatalog.findOne({ slug: 'favorite_person' }).lean();
    if (!favPerson){
      const doc2 = new ShowcaseCatalog({
        slug: 'favorite_person',
        title: 'Favorite Person',
        description: 'Highlight an actor or director you love with a short note.',
        tier: 'free',
        icon: null,
        max_instances: 1,
        config_schema: {
          mode: { type:'enum', values:['actor','director'], default:'actor' },
          person_id: { type:'string', default:'' },
          note: { type:'string', default:'' }
        },
        active: true
      });
      await doc2.save();
    }
    // Favorite Title
    const favTitle = await ShowcaseCatalog.findOne({ slug: 'favorite_title' }).lean();
    if (!favTitle){
      const doc3 = new ShowcaseCatalog({
        slug: 'favorite_title',
        title: 'Favorite Title',
        description: 'Spotlight a favorite movie or show with a personal note.',
        tier: 'free',
        icon: null,
        max_instances: 1,
        config_schema: {
          mode: { type:'enum', values:['movie','show'], default:'movie' },
          tmd_id: { type:'string', default:'' },
          note: { type:'string', default:'' }
        },
        active: true
      });
      await doc3.save();
    }
    // Favorite Movies (6 slots)
    const favMovies = await ShowcaseCatalog.findOne({ slug: 'favorite_movies' }).lean();
    if (!favMovies){
      const doc4 = new ShowcaseCatalog({
        slug: 'favorite_movies',
        title: 'My Favorite Movies',
        description: 'Pick up to six favorite movies to showcase.',
        tier: 'free',
        icon: null,
        max_instances: 1,
        config_schema: { items: { type: 'array', of: 'movie_id', max: 6 } },
        active: true
      });
      await doc4.save();
    }
    // Favorite Actors (6 slots)
    const favActors = await ShowcaseCatalog.findOne({ slug: 'favorite_actors' }).lean();
    if (!favActors){
      const doc5 = new ShowcaseCatalog({
        slug: 'favorite_actors',
        title: 'My Favorite Actors',
        description: 'Pick up to six favorite actors to showcase.',
        tier: 'free',
        icon: null,
        max_instances: 1,
        config_schema: { items: { type: 'array', of: 'person_id', max: 6 } },
        active: true
      });
      await doc5.save();
    }
    // My Badges (auto up to 12)
    const myBadges = await ShowcaseCatalog.findOne({ slug: 'my_badges' }).lean();
    if (!myBadges){
      const doc6 = new ShowcaseCatalog({
        slug: 'my_badges',
        title: 'My Badges',
        description: 'Show up to twelve of your earned badges.',
        tier: 'free',
        icon: null,
        max_instances: 1,
        config_schema: { count: { type:'enum', values:[6,12], default:12 } },
        active: true
      });
      await doc6.save();
    }
    // Favorite Shows (6 slots)
    const favShows = await ShowcaseCatalog.findOne({ slug: 'favorite_shows' }).lean();
    if (!favShows){
      const doc7 = new ShowcaseCatalog({
        slug: 'favorite_shows',
        title: 'My Favorite Shows',
        description: 'Pick up to six favorite shows to showcase.',
        tier: 'free',
        icon: null,
        max_instances: 1,
        config_schema: { items: { type: 'array', of: 'show_id', max: 6 } },
        active: true
      });
      await doc7.save();
    }
  } catch(_) {}
}

async function getPlanLimit(user){
  const plan = (user && user.account && user.account.plan) ? String(user.account.plan).toLowerCase() : 'free';
  return (plan === 'premium') ? 6 : 3;
}

function sanitizeConfig(slug, cfg){
  const safe = (cfg && typeof cfg === 'object') ? Object.assign({}, cfg) : {};
  if (slug === 'recent_timeline'){
    const allowed = new Set(['mixed','movies_only','shows_only']);
    const mode = String(safe.mode || 'mixed');
    let count = parseInt(safe.count, 10);
    if (count !== 6 && count !== 12) count = 12;
    return { mode: allowed.has(mode) ? mode : 'mixed', count };
  }
  if (slug === 'favorite_person'){
    const mode = (safe.mode==='director') ? 'director' : 'actor';
    const id = String(safe.person_id||'');
    const note = String(safe.note||'');
    return { mode, person_id: id, note };
  }
  if (slug === 'favorite_title'){
    const mode = (safe.mode==='show') ? 'show' : 'movie';
    const id = String(safe.tmd_id||'');
    const note = String(safe.note||'');
    return { mode, tmd_id: id, note };
  }
  if (slug === 'favorite_movies'){
    // Up to 6 movie TMDB ids
    const arr = Array.isArray(safe.items) ? safe.items : [];
    const items = arr.slice(0,6).map(v => String((v && (v.id||v)) || '').trim()).filter(Boolean);
    return { items };
  }
  if (slug === 'favorite_shows'){
    // Up to 6 show TMDB ids
    const arr = Array.isArray(safe.items) ? safe.items : [];
    const items = arr.slice(0,6).map(v => String((v && (v.id||v)) || '').trim()).filter(Boolean);
    return { items };
  }
  if (slug === 'favorite_actors'){
    // Up to 6 person TMDB ids
    const arr = Array.isArray(safe.items) ? safe.items : [];
    const items = arr.slice(0,6).map(v => String((v && (v.id||v)) || '').trim()).filter(Boolean);
    return { items };
  }
  if (slug === 'my_badges'){
    let count = parseInt(safe.count, 10);
    if (count !== 6 && count !== 12) count = 12;
    const arr = Array.isArray(safe.items) ? safe.items : [];
    const items = arr.slice(0, count).map(v => String((v && (v.id||v)) || '').trim()).filter(Boolean);
    return { count, items };
  }
  return safe;
}

module.exports = (server) => {
  console.log('* UserShowcases Routes Loaded Into Server');

  // Resolve ordered list of showcases for a user (auto-seed defaults when empty)
  server.get('/api/v1/user-showcases/:profile_id', async (req, res) => {
    try {
      const profileId = req.params.profile_id;
      const user = await User.findById(profileId).lean();
      if (!user) return res.status(404).send({ status: 404, message: 'User not found' });

      await ensureCatalogSeed();
      let catalog = await ShowcaseCatalog.find({ active: true }).lean();
      const catMap = new Map((catalog||[]).map(c => [String(c.slug), c]));

      let list = await UserShowcase.find({ user_id: user._id, enabled: true }).sort({ order: 1, _id: 1 }).lean();
      if (!list || list.length === 0){
        // Seed with one Recent Timeline (mixed)
        const def = new UserShowcase({ user_id: user._id, slug: 'recent_timeline', order: 0, config: { mode: 'mixed' }, enabled: true });
        try { await def.save(); } catch(_) {}
        list = [ def.toObject() ];
      }

      // Filter out entries not present/active in catalog
      const resolved = list.filter(it => catMap.has(String(it.slug))).map(it => ({
        slug: it.slug,
        order: it.order || 0,
        enabled: !!it.enabled,
        config: sanitizeConfig(it.slug, it.config),
        title: (catMap.get(String(it.slug)) || {}).title || it.slug,
        meta: { max_instances: (catMap.get(String(it.slug)) || {}).max_instances || 1, tier: (catMap.get(String(it.slug)) || {}).tier || 'free' }
      })).sort((a,b)=> (a.order||0) - (b.order||0));

      return res.send({ ok:true, user_id: user._id, showcases: resolved });
    } catch (e) {
      return res.status(500).send({ ok:false });
    }
  });

  // Replace full selection for a user
  server.put('/api/v1/user-showcases/:profile_id', apiIsCorrectUser, async (req, res) => {
    try {
      const profileId = req.params.profile_id;
      const user = await User.findById(profileId);
      if (!user) return res.status(404).send({ ok:false, message: 'User not found' });
      await ensureCatalogSeed();
      const catalog = await ShowcaseCatalog.find({ active: true }).lean();
      const catMap = new Map((catalog||[]).map(c => [String(c.slug), c]));

      const payload = Array.isArray(req.body && req.body.showcases) ? req.body.showcases : [];
      // Normalize and validate
      const normalized = [];
      const counts = new Map();
      for (let i=0;i<payload.length;i++){
        const item = payload[i] || {};
        const slug = String(item.slug || '').trim();
        if (!slug || !catMap.has(slug)) continue;
        const cat = catMap.get(slug);
        const idx = Number(item.order); const order = isFinite(idx) ? idx : i;
        const enabled = (item.enabled !== false);
        const cfg = sanitizeConfig(slug, item.config);
        const count = (counts.get(slug) || 0) + 1; counts.set(slug, count);
        normalized.push({ slug, order, enabled, config: cfg });
      }
      // Enforce per-slug max instances
      for (const [slug, count] of counts.entries()){
        const max = (catMap.get(slug).max_instances || 1);
        if (count > max) return res.status(400).send({ ok:false, message: `Too many instances for ${slug} (max ${max})` });
      }
      // Enforce plan limits (enabled only)
      const enabledCount = normalized.filter(x => x.enabled).length;
      const maxForPlan = await getPlanLimit(user);
      if (enabledCount > maxForPlan){
        return res.status(400).send({ ok:false, message: `Showcase limit exceeded for plan (${enabledCount}/${maxForPlan})` });
      }

      // Replace selection
      await UserShowcase.deleteMany({ user_id: user._id });
      const docs = normalized.map((x, i) => new UserShowcase({ user_id: user._id, slug: x.slug, order: Number(x.order||i), config: x.config || {}, enabled: !!x.enabled }));
      if (docs.length) await UserShowcase.insertMany(docs);

      return res.send({ ok:true });
    } catch (e) {
      return res.status(500).send({ ok:false });
    }
  });
}
