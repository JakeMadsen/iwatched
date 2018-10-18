module.exports = (server) => {
    console.log('======== Loading API V1 Routes ========')
    /* API ROUTES */
    require("./api/v1/movies")(server);


    console.log('======== Loading Public Routes ========')
    /* PUBLIC ROUTES */
    require("./public/index")(server);
    require("./public/movies")(server);
    require("./public/shows")(server);
    require("./public/about")(server);
    require("./public/login")(server);

    console.log('======== Loading Private Routes ========')
    /* PRIVATE ROUTES */
    require("./private/index")(server);
}