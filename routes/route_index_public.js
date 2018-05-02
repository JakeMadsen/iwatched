module.exports = (server) => {
    console.log('======== Loading Public Routes ========')
    /* PUBLIC ROUTES */
    require("./public/index")(server);
    require("./public/movies")(server);
    require("./public/shows")(server);
    require("./public/about")(server);
    require("./public/login")(server);
}