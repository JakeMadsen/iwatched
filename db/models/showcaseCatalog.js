const mongoose = require('mongoose');

// Catalog of available profile showcases (admin editable)
const ShowcaseCatalogSchema = mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  tier: { type: String, enum: ['free', 'premium'], default: 'free' },
  icon: { type: String, default: null },
  max_instances: { type: Number, default: 1 },
  // Arbitrary config schema to help UIs render editors (kept flexible for now)
  config_schema: { type: mongoose.Schema.Types.Mixed, default: {} },
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

ShowcaseCatalogSchema.pre('save', function(next){ this.updated_at = new Date(); next(); });

module.exports = mongoose.model('ShowcaseCatalog', ShowcaseCatalogSchema, 'showcase_catalog');
