const mongoose = require('mongoose');

// Reuse a comment schema similar to announcements
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
}, { _id: true });

const reviewSchema = new mongoose.Schema({
  item_type: { type: String, enum: ['movie','show'], required: true, index: true },
  item_id: { type: String, required: true, index: true }, // TMDB id as string to be safe
  title: { type: String, required: true },
  text: { type: String, default: '' },
  stars: { type: Number, min: 0, max: 5, default: 0 }, // allow halves via frontend
  author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  author_username: { type: String, default: '' },
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: null },
  deleted: { type: Boolean, default: false, index: true },
  upvotes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  downvotes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  comments: { type: [commentSchema], default: [] }
});

// Ensure one review per user per item (soft uniqueness in code; index not unique due to soft delete)
reviewSchema.index({ item_type: 1, item_id: 1, author_id: 1 });

module.exports = mongoose.model('Review', reviewSchema, 'reviews');

