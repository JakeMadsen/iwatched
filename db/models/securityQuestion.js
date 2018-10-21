var mongoose = require('mongoose');

var securityQuestionSchema = mongoose.Schema({
    question: { type: String, unique: true }
});

module.exports = mongoose.model('SecurityQuestion', securityQuestionSchema, 'security_questions');