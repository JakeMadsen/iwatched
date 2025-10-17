const mongoose = require('mongoose');

const ModeratorPersonaSchema = mongoose.Schema({
  name: { type: String, required: true, unique: true },
  avatar: { type: String, default: null }, // filename under /public/style/img/personas
  assigned_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ModeratorPersona', ModeratorPersonaSchema, 'moderator_personas');

