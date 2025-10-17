const tmdMovies = require('../../services/movies')
const tmdShows = require('../../services/shows')

module.exports = function (server) {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/', 
        async function(req, res) {
            let popularMovies = [];
            let popularShows = [];
            try { popularMovies = await tmdMovies.getPopularMovies(); } catch (e) { try { console.error('[Home] popularMovies failed:', e && e.message || e); } catch(_){} }
            try { popularShows = await tmdShows.getPopularShows(); } catch (e) { try { console.error('[Home] popularShows failed:', e && e.message || e); } catch(_){} }

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
