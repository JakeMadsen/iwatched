module.exports = function (server) {
    server.get('/about', 
        function(req, res) {
            res.render('public assets/pages/about', {
                title: "About"
            });
        }
    );
}
