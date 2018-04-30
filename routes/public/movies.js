const fetch = require('node-fetch');

module.exports = function (server) {
    console.log('* Movie Routes Loaded Into Server');

    server.get('/movies', function (req, res) {
        res.render('public assets/pages/movies', {
            title: "Movies",
            searchType: "movie"
        });
    });
}

function getSearch(){

}