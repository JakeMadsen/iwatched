const User = require('../../../../db/models/user');
const userService = require('../../../services/users')

var myApiKey = "ED7Qm5U4w7EMCBK6tvVfBF"

module.exports = (server) => {
    console.log('* User Routes Loaded Into Server');

    server.get('/api/v1/users/all/:page?', async (req, res) => {
        let key = req.query.apikey;

        if (key != myApiKey)
            res.send({ status: 401, message: "You do not have access without api key" })
        else {
            var perPage = 20,
                page = Math.max(0, req.params.page);

            User
            .find({})
            .limit(perPage)
            .skip(perPage * page)
            .sort({ 'local.username': 'asc' })
            .exec((error, users) => {
                if (error)
                    res.send({ status: 400, message: "Something went wrong", error: error })

                User.count((error, count) => {
                    let pages = 1;
                    if(count / perPage > 1)
                        pages = count / perPage

                    if (error)
                        res.send({ status: 400, message: "Something went wrong", error: error })
                    else
                        res.send({ 
                            status: 200, 
                            page: page, 
                            total_results: count, 
                            total_pages: pages, 
                            results: users
                        })
                })
            })
        }
    });

    server.get('/api/v1/users/one/:id?', async (req, res) => {
        let key = req.query.apikey;

        if (key != myApiKey)
            res.send({ status: 401, message: "You do not have access without api key" })
        else {
         
            User
            .find({_id : req.params.id})
            .exec((error, user) => {
                if (error)
                    res.send({status: 400, message: "Something went wrong", error: error})
                if(!user)
                    res.send({status: 404, message: "No user found"})
                if(user)
                    res.send({status: 200, user: user})
            })
        }
    });
}