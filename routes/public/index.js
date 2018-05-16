module.exports = function (server) {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/', 
        function(req, res) {
            res.render('public assets/pages/index', {
                title: "Home",
                user : req.user // get the user out of session and pass to template
            });
        }
    );
}
