module.exports = (server) => {
    console.log('======== Loading API Routes ========')
    require("./api/index")(server);

    console.log('API V1 Routes')
    /* API V1 ROUTES */
    require("./api/v1/movies")(server);
    require("./api/v1/users")(server);
    require("./api/v1/profile")(server);

    console.log('======== Loading Private Routes ========')
    /* PRIVATE ROUTES */
    require("./private/index")(server);
    require("./private/blacklist")(server);

    console.log('======== Loading Public Routes ========')
    /* PUBLIC ROUTES */
    require("./public/index")(server);
    require("./public/movies")(server);
    require("./public/shows")(server);
    require("./public/about")(server);
    require("./public/contact")(server);
    require("./public/login")(server);
    require("./public/profile")(server);

    
}