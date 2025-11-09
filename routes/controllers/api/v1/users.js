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

            try {
                const users = await User.find({}).limit(perPage).skip(perPage * page).sort({ 'local.username': 'asc' }).lean();
                const count = await User.countDocuments({});
                const pages = count > perPage ? Math.ceil(count / perPage) : 1;
                return res.send({ status: 200, page, total_results: count, total_pages: pages, results: users });
            } catch (error) {
                return res.send({ status: 400, message: "Something went wrong", error });
            }
        }
    });

    server.get('/api/v1/users/one/:id?', async (req, res) => {
        let key = req.query.apikey;

        if (key != myApiKey)
            res.send({ status: 401, message: "You do not have access without api key" })
        else {
         
            try {
                const user = await User.findOne({ _id: req.params.id }).lean();
                if (!user) return res.send({ status: 404, message: "No user found" });
                return res.send({ status: 200, user });
            } catch (error) {
                return res.send({ status: 400, message: "Something went wrong", error });
            }
        }
    });

}
