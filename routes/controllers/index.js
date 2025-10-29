module.exports = (server) => {
    console.log('======== Loading API Routes ========')
    require("./api/index")(server);

    console.log('API V1 Routes')
    /* API V1 ROUTES */
    require("./api/v1/movies")(server);
    require("./api/v1/shows")(server);
    require("./api/v1/search")(server);
    require("./api/v1/users")(server);
    require("./api/v1/userSessions")(server);
    require("./api/v1/profile")(server);
    require("./api/v1/friends")(server);
    require("./api/v1/support")(server);
    require("./api/v1/announcements")(server);
    require("./api/v1/userMovies")(server);
    require("./api/v1/userShows")(server);
    require("./api/v1/recommendations")(server);
    require("./api/v1/reports")(server);
    // Mixed user activity (movies + shows)
    try { require("./api/v1/userActivity")(server); } catch(_){}

    console.log('======== Loading Private Routes ========')
    /* PRIVATE ROUTES */
    require("./private/index")(server);
    require("./private/users")(server);
    require("./private/restrictedUrls")(server);
    require("./private/support")(server);
    require("./private/personas")(server);
    require("./private/reports")(server);
    require("./private/contact")(server);
    require("./private/badges")(server);
    require("./private/announcements")(server);
    try { require("./private/admins")(server); } catch(_){}
    try { require("./private/uploads")(server); } catch(_){}
    try { require("./private/apiMetrics")(server); } catch(_){}

    console.log('======== Loading Public Routes ========')
    /* PUBLIC ROUTES */
    require("./public/index")(server);
    require("./public/movies")(server);
    const showsModule = require("./public/shows");
    showsModule(server);
    // Attach auxiliary APIs exposed by shows controller
    if (typeof showsModule.attachRuntimeApi === 'function') {
        showsModule.attachRuntimeApi(server);
    }
    require("./public/pages")(server);
    require("./public/contact")(server);
    require("./public/support")(server);
    require("./public/login")(server);
    require("./public/profile")(server);
    require("./public/recommendations")(server);
    // Temporary profile (new user_movies-backed views)
    try { require("./public/profile_temp")(server); } catch (_) {}
    require("./public/person")(server);
    require("./public/announcements")(server);

    
}
