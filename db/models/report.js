const mongoose = require('mongoose');

const moderatorNoteSchema = new mongoose.Schema({
  by_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, default: '' },
  at: { type: Date, default: Date.now }
}, { _id: false });

const reportSchema = new mongoose.Schema({
  reported_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reporter_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  context: { type: String, enum: ['comment','review','user','other'], default: 'comment', index: true },
  meta: {
    announcement_id: { type: String, default: null },
    comment_id: { type: String, default: null },
    review_id: { type: String, default: null }
  },
  reason: { type: String, default: '' },
  status: { type: String, enum: ['open','action_taken','resolved'], default: 'open', index: true },
  moderator_notes: { type: [moderatorNoteSchema], default: [] },
  actions: { type: Array, default: [] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

reportSchema.index({ created_at: -1 });

module.exports = mongoose.model('Report', reportSchema, 'reports');

