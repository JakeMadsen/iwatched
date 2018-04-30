module.exports = function (server) {
    console.log('* About Routes Loaded Into Server');
    server.get('/about', 
        function(req, res) {
            res.render('public assets/pages/about', {
                title: "About"
            });
        }
    );
}
