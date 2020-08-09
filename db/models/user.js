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
        inactive:           { type: Boolean, default: false },  
        banner_image:       { type: String, default: null },
        profile_image:      { type: String, default: 'profile-picture-missing.png' },
        description:        { type: String, default: null },
        birthday:           { type: String, default: null },
        gender:             { type: String, default: null },
        custom_url:         { type: String, default: hat(), index: {unique : true} }
    },
    permissions: {
        user_private_key: { type: String, default: hat()},
        level: {
            admin: { type: Boolean, default: false }
        }
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
    let check = await checkIfCustomUrlAvailable(body.custom_url);

    if(this.local.username != body.username && body.username != "")
        this.local.username = body.username;

    if(this.local.email != body.email && body.email != "")
        this.local.email = body.email;

    if(body.password != "" && body.password != this.validPassword(body.password))
        this.local.password = this.generateHash(body.password);

    if(check == true){
        if(this.profile.custom_url != body.custom_url && body.custom_url != ""){
            this.profile.custom_url = body.custom_url;
        }
    }

    if(this.profile.birthday != body.birthday && body.birthday != "")
        this.profile.birthday = body.birthday;

    if(this.profile.description != body.description && body.description != "")
        this.profile.description = body.description;

    if(this.profile.profile_image != profilePicture && profilePicture != "" && profilePicture != null)
        this.profile.profile_image = profilePicture;

    if(this.profile.banner_image != profileBanner && profileBanner != "" && profileBanner != null)
        this.profile.banner_image = profileBanner;

};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema, 'users');

async function checkIfCustomUrlAvailable(new_url){
    return new Promise ((resolve, reject) =>{
        restrictedUrlService
        .checkUrl(new_url)
        .then(check => {
            if(check == null)
                resolve(true)
            else
                reject(false)
        })
    })
    
}