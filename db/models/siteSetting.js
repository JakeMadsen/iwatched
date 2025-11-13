const mongoose = require('mongoose');

const siteSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  updated_at: { type: Date, default: Date.now }
});

siteSettingSchema.pre('save', function(next){ this.updated_at = new Date(); next(); });

module.exports = mongoose.model('SiteSetting', siteSettingSchema, 'site_settings');

