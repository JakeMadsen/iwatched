module.exports = function (server) {
    console.log('* Login Routes Loaded Into Server');
    
    server.get('/login', 
        function(req, res) {
            res.render('public assets/pages/login', {
                title: "Login"
            });
        }
    );
}
