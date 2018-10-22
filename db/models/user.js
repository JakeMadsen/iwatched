var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
var hat = require('hat');

// define the schema for our user model
var userSchema = mongoose.Schema({
    local: {
        username:   { type: String },
        email:      { type: String },
        password: String,
    },
    security : {
        phone: { type: String, default: null },
        security_question: {
            question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SecurityQuestion' },
            answer: { type: String, default: null}
        }
    },
    permissions: {
        level: {
            admin: { type: Boolean, default: false },
            moderator: { type: Boolean, default: false }
        }, 
        apiKey: {
            key: { type: String, default: "" },
            received_date: Date,
            received_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        },
        myKey: { type: String, default: hat()}
    },
    social: {
        facebook: {
            id: String,
            token: String,
            name: String,
            email: String
        },
        google: {
            id: String,
            token: String,
            email: String,
            name: String
        }
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
        custom_url:         { type: String, default: null },
        total_watch_time:   { type: Number, default: 0 },
        movie_watch_time:   { type: Number, default: 0 },
        show_watch_time:    { type: Number, default: 0 }
    },
    movies: {
        watched:    { type: Array, default: [] },
        saved:      { type: Array, default: [] },
        favourite:  { type: Array, default: [] }
    },
    series: {
        watched:    { type: Array, default: [] },
        saved:      { type: Array, default: [] },
        favourite:  { type: Array, default: [] }
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
userSchema.methods.updateSettings = function (body, profilePicture, profileBanner){
    if(this.local.username != body.username && body.username != "")
        this.local.username = body.username;

    if(this.local.email != body.email && body.email != "")
        this.local.email = body.email;

    if(body.password != "" && body.password != this.validPassword(body.password))
        this.local.password = this.generateHash(body.password);

    if(this.profile.custom_url != body.custom_url && body.custom_url != "")
        this.profile.custom_url = body.custom_url;

    if(this.profile.birthday != body.birthday && body.birthday != "")
        this.profile.birthday = body.birthday;

    if(this.profile.description != body.description && body.description != "")
        this.profile.description = body.description;

    if(this.profile.profile_image != profilePicture && profilePicture != "" && profilePicture != null)
        this.profile.profile_image = profilePicture;

    if(this.profile.banner_image != profileBanner && profileBanner != "" && profileBanner != null)
        this.profile.banner_image = profileBanner;

};

userSchema.methods.addMovieRuntime = function (time){
    let totalTime = +this.profile.total_watch_time + +time;
    let totalMovieTime = +this.profile.movie_watch_time + +time;
    this.profile.total_watch_time = totalTime;
    this.profile.movie_watch_time = totalMovieTime;
}

userSchema.methods.addMovieWatched = function (id){
    let movie = {
        movie_id: id,
        times_watched: 1
    }

    this.movies.watched.push(movie);
}

userSchema.methods.checkMovieWatched = function (id){
    
}


// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema, 'users');