const Blacklist = require('../../db/models/blacklistedUrl')
const Page = require('../../db/models/page')
const createError = require('http-errors');

module.exports = {
    getAll: () => {
        return new Promise(function (resolve, reject) {
            Blacklist
                .find({})
                .exec((error, list) => {
                    if (error)
                        throw new Error(createError(503, "Issue with fetching data"))
                    if (list)
                        resolve(list)
                })
        })
    },
    blackListPage: (body) => {
        return new Promise((resolve, reject) => {
            Blacklist
            .find({ name: body.name })
            .exec((error, blacklisted) => {
                if (error)
                    throw new Error(createError(503, "Issue with blacklisting new page"))
                if (blacklisted)
                    resolve(true)

                let newPage = new Page();
                newPage.initial(body);

                newPage.save((error, page) => {
                    if (error)
                        throw new Error(createError(503, "Issue with blacklisting new page"))

                    let newBlacklist = new Blacklist()
                    newBlacklist.initial(page.name, page._id, "PAGE")

                    newBlacklist.save((error, blacklist) => {
                        if (error)
                            throw new Error(createError(503, "Issue with blacklisting new page"))

                        resolve(true)
                    })
                })
            })
        })
    }
}
