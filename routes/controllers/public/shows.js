// const tmdService = require('../../services/themoviedatabase')
const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb('ab4e974d12c288535f869686bd72e1da')

module.exports = function (server) {
    console.log('* Show Routes Loaded Into Server');
    
    server.get('/shows', 
        async function(req, res) {
            res.render('public assets/template.ejs', {
                page_title: "iWatched.xyz - Shows",
                page_file: "shows",
                page_data: {

                },
                user: req.user
            });
        }
    );

    server.get('/shows/:id', 
        async function(req, res) {
            let show = await tmdService.tvInfo(req.params.id)
            let videos = await tmdService.tvVideos(req.params.id)

            // res.send(show)

            res.render('public assets/template.ejs', {
                page_title: `iWatched - ${show.name}`,
                page_file: "shows",
                page_subFile: "one",
                page_data: {
                    show: show,
                    show_videos: videos.results
                },
                user: req.user
            });
        }
    );
}
