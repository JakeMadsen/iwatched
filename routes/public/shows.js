module.exports = function (server) {
    console.log('* Show Routes Loaded Into Server');
    
    server.get('/shows', 
        function(req, res) {
            res.render('public assets/pages/shows', {
                title: "Shows",
                searchType: "tv"
            });
        }
    );
}
