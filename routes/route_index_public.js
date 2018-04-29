module.exports = (server) => {
    /* PUBLIC ROUTES */
    require("./public/index")(server);
    require("./public/movies")(server);
    require("./public/shows")(server);
    require("./public/about")(server);
}