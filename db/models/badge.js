const mongoose = require('mongoose');

const BadgeSchema = mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: null }, // filename under /public/style/img/badges
  // For multi-level badges, ordered list of level definitions. For single badges, leave empty array.
  levels: { type: [ new mongoose.Schema({ name: String, description: { type: String, default: '' } }, { _id: false }) ], default: [] },
  kind: { type: String, enum: ['manual','tenure','flag'], default: 'manual' },
  config: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { thresholds:[{level,days}] } or { flag:'beta_tester' }
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Badge', BadgeSchema, 'badges');
