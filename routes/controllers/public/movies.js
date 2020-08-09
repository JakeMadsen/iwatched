// const tmdService = require('../../services/themoviedatabase')
const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb('ab4e974d12c288535f869686bd72e1da');

module.exports = (server) => {
    console.log('* Movie Routes Loaded Into Server');
    
    server.get('/movies', async (req, res) => {
        const genres = await tmdService.genreMovieList()
        res.render('public assets/template.ejs', {
            page_title: "iWatched - Movies",
            page_file: "movies",
            page_subFile: "all",
            page_data: {
                genres: genres.genres
            },
            user: req.user
        });
    });

    server.get('/movies/:id', async (req, res) => {
        let movie = await tmdService.movieInfo(req.params.id)
        let videos = await tmdService.movieVideos(req.params.id)
        let similar = await tmdService.movieSimilar(req.params.id)
        let runtime = getRunTime(movie.runtime);

        res.render('public assets/template.ejs', {
            page_title: `iWatched - ${movie.title}`,
            page_file: "movies",
            page_subFile: "one",
            page_data: {
                movie: movie,
                movie_videos: videos.results,
                runtime:  runtime,
                similar: similar.results
            },
            user: req.user
        });
    });

}
function checkIfWatched(movie_id, movies){
    let check = false;
    movies.forEach(movie => {
        if(movie.movie_id == movie_id)
            check = true;
    });
    return check;
}

function getRunTime(runtime){
    var hours = Math.floor( runtime / 60);          
    var minutes = runtime % 60;
    var text = "hour"

    if(hours > 1)
        text = "hours"

    return(`${hours} ${text} and ${minutes} minutes`);
}

