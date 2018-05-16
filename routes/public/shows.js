module.exports = function (server) {
    console.log('* Show Routes Loaded Into Server');
    
    server.get('/shows', 
        function(req, res) {
            res.render('public assets/pages/shows', {
                title: "Shows",
                searchType: "tv",
                user : req.user // get the user out of session and pass to template
            });
        }
    );
}
