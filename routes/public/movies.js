module.exports = function (server) {
    console.log('* Movie Routes Loaded Into Server');

    server.get('/movies', function (req, res) {

        res.render('public assets/pages/movies', {
            title: "Movies",
            searchType: "movie",
            user : req.user // get the user out of session and pass to template
        });
    });

    server.post('/movies', function ( req, res) {
        console.log(req.body)
        res.send("404")
        console.log("Test")
    })
}

function getSearch(){

}