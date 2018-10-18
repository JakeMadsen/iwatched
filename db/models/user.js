var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

// define the schema for our user model
var userSchema = mongoose.Schema({
    local: {
        username: String,
        email: String,
        password: String,
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
        phone: String,  
        newsletter: Boolean,
        registration_date: { type: Date, default: Date.now },
        private: { type: Boolean, default: false },
        inactive:{ type: Boolean, default: false },  
        cover_image: String,
        profile_image: String,
        description: String,
        birthday: String,
        gender: String,
        watched_movies: Array,
        watched_series: Array,
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
userSchema.methods.updateUser = function (username, email, phone, password){
    if(username != null && username != this.local.username)
        this.local.username = username;

    if(email != null && email != this.local.email)
        this.local.email = email

    if(phone != null && phone != this.local.phone)
        this.local.phone = phone

    if(password != "" && password != this.validPassword(password))
        this.local.password = this.generateHash(password);
};

userSchema.methods.addWatched = function (id, type){
    let newWatched = {
        "id" : null,
        "times" : 1,
    }
    let check = false;
    if(type == "series"){
        let series = this.local.watched_series;

        for(i=0; i <= series.length; i++){
            if(series[i] == id)
                check = true
        }
        if(check != true)
            this.local.watched_series.push(id)
    }
    else if(type == "movies"){
        let movies = this.local.watched_movies;

        for(i=0; i <= movies.length; i++){
            if(movies[i] == id)
                check = true
        }
        if(check != true)
            this.local.watched_movies.push(id)
    }
}

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);