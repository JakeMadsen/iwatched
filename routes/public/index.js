module.exports = function (server) {
    server.get('/', 
        function(req, res) {
            res.render('public assets/pages/index', {
                title: "Home"
            });
        }
    );
}
