module.exports = function (server) {
    server.get('/shows', 
        function(req, res) {
            res.render('public assets/pages/shows', {
                title: "Shows"
            });
        }
    );
}
