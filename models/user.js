var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

// define the schema for our user model
var userSchema = mongoose.Schema({
    local: {
        username: String,
        email: String,
        phone: String,
        password: String,
        newsletter: Boolean,
        registration_date: { type: Date, default: Date.now },
        profile: {
            cover_image: String,
            profile_image: String,
            description: String,
            birthday: String,
            gender: String
        },
        watched_movies: Array,
        watched_series: Array,
        saved_movies: Array,
        saved_series: Array
    },
    social: {
        facebook: {
            id: String,
            token: String,
            name: String,
            email: String
        },
        twitter: {
            id: String,
            token: String,
            displayName: String,
            username: String
        },
        google: {
            id: String,
            token: String,
            email: String,
            name: String
        }
    }
});

// methods ======================
// generating a hash
userSchema.methods.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function (password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);