var apiKeySchema = mongoose.Schema({
    name: { type: String, unique: true, required: true },
    key: { type: String, unique: true, required: true }
});

module.exports = mongoose.model('ApiKey', apiKeySchema, 'api_keys');