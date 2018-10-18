module.exports = function (server) {
    console.log('* About Routes Loaded Into Server');
    
    server.get('/about', 
        async function(req, res) {
            res.render('public assets/template.ejs', {
                page_title: "iWatched.xyz - About",
                page_file: "about",
                page_data: {

                },
                user: req.user
            });
        }
    );
}
