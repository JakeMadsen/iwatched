const mongoose = require('mongoose');
const bcrypt = require('bcrypt-nodejs');
const hat = require('hat');
const restrictedUrlService = require('../../routes/services/restrictedUrls');


// define the schema for our user model
var userSchema = mongoose.Schema({
    local: {
        username:   { type: String, default: null, index: {unique : true} },
        email:      { type: String, default: null, index: {unique : true}},
        password: String,
    },
    profile: {
        registration_date:  { type: Date, default: Date.now },
        private:            { type: Boolean, default: false }, 
        visibility:         { type: String, enum: ['public','friends','private'], default: 'public' },
        flags:              { 
            beta_tester: { type: Boolean, default: false },
            premium: { type: Boolean, default: false }
        },
        inactive:           { type: Boolean, default: false },  
        banner_image:       { type: String, default: null },
        profile_image:      { type: String, default: 'profile-picture-missing.png' },
        description:        { type: String, default: null },
        birthday:           { type: String, default: null },
        gender:             { type: String, default: null },
        custom_url:         { type: String, default: hat(), index: {unique : true} },
        featured_badge_id:  { type: mongoose.Schema.Types.ObjectId, default: null },
        user_badges:        { type: [
            new mongoose.Schema({
                badge_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Badge' },
                level: { type: String, default: 'single' }, // for multi-level badges, store level name; for single, 'single'
                awarded_at: { type: Date, default: Date.now }
            }, { _id: false })
        ], default: [] }
    },
    permissions: {
        user_private_key: { type: String, default: hat()},
        level: {
            admin: { type: Boolean, default: false }
        }
    },
    account: {
        plan: { type: String, enum: ['free','premium'], default: 'free' },
        premium_since: { type: Date, default: null },
        premium_until: { type: Date, default: null }
    }
});

// methods ======================
userSchema.methods.initialSignup = function(username, email, password){
    this.local.username = username;
    this.local.email = email;
    this.local.password = this.generateHash(password);
}

// generating a hash
userSchema.methods.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function (password) {
    return bcrypt.compareSync(password, this.local.password);
};

// updates main user details
userSchema.methods.updateSettings = async function (body, profilePicture, profileBanner){
    const restrictedUrlService = require('../../routes/services/restrictedUrls');
    const validation = await restrictedUrlService.validateCustomUrl(body.custom_url);

    if(this.local.username != body.username && body.username != "")
        this.local.username = body.username;

    if(this.local.email != body.email && body.email != "")
        this.local.email = body.email;

    if (body.password && body.password.trim() !== "")
        this.local.password = this.generateHash(body.password.trim());

    if(validation && validation.ok === true){
        if(this.profile.custom_url != body.custom_url && body.custom_url != ""){
            this.profile.custom_url = body.custom_url.toLowerCase();
        }
    }

    if(this.profile.birthday != body.birthday && body.birthday != "")
        this.profile.birthday = body.birthday;

    if(this.profile.description != body.description && body.description != "")
        this.profile.description = body.description;

    if (body.visibility && ['public','friends','private'].includes(String(body.visibility))) {
        this.profile.visibility = String(body.visibility);
        this.profile.private = (this.profile.visibility === 'private');
    }

    if(this.profile.profile_image != profilePicture && profilePicture != "" && profilePicture != null)
        this.profile.profile_image = profilePicture;

    if(this.profile.banner_image != profileBanner && profileBanner != "" && profileBanner != null)
        this.profile.banner_image = profileBanner;

    // Featured badge selection (only allow if user owns it)
    if (typeof body.featured_badge !== 'undefined') {
        try {
            const sel = String(body.featured_badge || '').trim();
            if (!sel) {
                this.profile.featured_badge_id = null;
            } else {
                const owns = Array.isArray(this.profile.user_badges) && this.profile.user_badges.some(b => String(b.badge_id) === sel);
                if (owns) this.profile.featured_badge_id = sel;
            }
        } catch (_) {}
    }

};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema, 'users');
