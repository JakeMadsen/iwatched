
module.exports = function (server) {
    console.log('* Index Routes Loaded Into Server');
    
    server.get('/api', 
        async function(req, res) {
            res.render('api assets/template.ejs', {
                page_title: "iWatched - Home",
                page_file: "index",
                user: req.user
            });
        }
    );
}
