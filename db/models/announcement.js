const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String, default: '' },
  message: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  edited_at: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
  parent_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  upvotes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  downvotes: { type: [mongoose.Schema.Types.ObjectId], default: [] }
});

const impressionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now }
}, { _id: false });

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, default: '', index: true },
  text: { type: String, required: true },
  created_at: { type: Date, default: Date.now, index: true },
  comments: { type: [commentSchema], default: [] },
  impressions: { type: [impressionSchema], default: [] }
});

// Ensure slug on save if missing
announcementSchema.pre('save', function(next){
  try {
    if(!this.slug && this.title){
      this.slug = String(this.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80);
    }
  } catch(_) {}
  next();
});

module.exports = mongoose.model('Announcement', announcementSchema, 'announcements');
