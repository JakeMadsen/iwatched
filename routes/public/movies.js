const fetch = require('node-fetch');

module.exports = function (server) {
    server.get('/movies', function (req, res) {
        res.render('public assets/pages/movies', {
            title: "Movies"
        });
    });

    server.post('/movies/search', function (req, res) {
        // let search_input = req.body.search_input
        console.log("post")

        // console.log("Search Input: "+search_input)

        // fetch(`https://api.themoviedb.org/3/search/movie?api_key=ab4e974d12c288535f869686bd72e1da&language=en-US&query=${search_input}&page=1&include_adult=false`)
        // .then(response => {
        //     return response.json()
        // })
    });
}

function getSearch(){

}