const RestrictedUrl = require('../../db/models/restrictedUrls')

module.exports = {
    getOne: (value) => {
        return new Promise(function (resolve, reject ) {
            RestrictedUrl
            .findOne({restrictedUrl: url})
            .exec((error, url) => {
                if (error)
                    reject(error)
                if(!url)
                    resolve(null)
                if (url)
                    resolve(url)
            })
        })
    },
    getAll: () => {
        return new Promise(function (resolve, reject ) {
            RestrictedUrl
            .find({})
            .exec((error,list) => {
                if (error)
                    reject(error)
                if (list)
                    resolve(list)
            })
        })
    },
    create: (user_id, data) => {
        return new Promise (function( resolve, reject ) {
            RestrictedUrl
            .find({ name: data.name })
            .exec( (error, blacklisted ) => {

                if (error)
                    reject(error)
                if (blacklisted)
                    resolve(true)

                let newRestriction = new RestrictedUrl()
                newRestriction.initial(user_id, data.name, data.text)

                newRestriction.save((error, restriction) => {
                    if (error)
                        reject(error)

                    resolve(true)
                })
            })
        })
    },
    checkUrl: (value) => {
        return new Promise(function (resolve, reject ) {
            RestrictedUrl
            .findOne({restrictedUrl: value})
            .exec((error, url) => {
                if (error)
                    reject(error)
                if(!url)
                    resolve(null)
                if (url)
                    resolve(url)
            })
        })
    },
}
