module.exports = function (server) {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/', 
        function(req, res) {
            res.render('public assets/pages/index', {
                title: "Home"
            });
        }
    );
}
