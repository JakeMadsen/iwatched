var pageSchema = mongoose.Schema({
    name: { type: String, unique: true },
    text: String,
    creation_date: { type: Date, default: Date.now() }
});

module.exports = mongoose.model('Page', pageSchema, 'pages');