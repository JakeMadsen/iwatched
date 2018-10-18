const tmdMovies = require('../../services/movies')
const tmdShows = require('../../services/shows')

module.exports = function (server) {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/', 
        async function(req, res) {
            let popularMovies = await tmdMovies.getPopularMovies()
            let popularShows = await tmdShows.getPopularShows()

            res.render('public assets/template.ejs', {
                page_title: "iWatched.xyz - Home",
                page_file: "index",
                page_data: {
                    popular: {
                        movies: popularMovies,
                        shows: popularShows
                    }
                },
                user: req.user
            });
        }
    );
}
