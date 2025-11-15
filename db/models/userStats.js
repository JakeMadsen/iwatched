const mongoose = require('mongoose');

const userStatsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    generated_at: { type: Date, default: Date.now },
    source_last_seen_at: { type: Date, default: null }
});

userStatsSchema.index({ user_id: 1 }, { unique: true });

module.exports = mongoose.model('UserStats', userStatsSchema, 'user_stats');

