module.exports = function (server) {
    server.post('/login', 
        function(req, res) {
            res.render('public assets/pages/index', {
                title: "Home"
            });
        }
    );
}
