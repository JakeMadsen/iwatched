const tmdMovies = require('../../services/movies');
const tmdShows = require('../../services/shows');

module.exports = function (server) {
    console.log('* Index Routes Loaded Into Server');
    
    // New Home: use the new design from temp_home and hydrate with TMDb popular
    server.get('/', async function(req, res) {
        let popularMovies = [];
        let popularShows = [];
        try {
            popularMovies = await tmdMovies.getPopularMovies();
            // Extra safety: apply client-side rules here as well
            popularMovies = (popularMovies||[]).filter(m => (m && m.release_date) && Number(m.vote_count||0) > 0);
        } catch (e) { try { console.error('[Home] popularMovies failed:', e && e.message || e); } catch(_){} }
        try {
            popularShows = await tmdShows.getPopularShows();
            popularShows = (popularShows||[]).filter(s => {
                const ids = Array.isArray(s && s.genre_ids) ? s.genre_ids : [];
                const notReality = !ids.includes(10764);
                const notTalk = !ids.includes(10767);
                const notNews = !ids.includes(10763);
                const notDoc = !ids.includes(99);
                const hasDate = !!(s && s.first_air_date);
                const hasVotes = Number(s && s.vote_count || 0) > 0;
                return notReality && notTalk && notNews && notDoc && hasDate && hasVotes;
            });
        } catch (e) { try { console.error('[Home] popularShows failed:', e && e.message || e); } catch(_){} }
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Home",
            page_file: "temp_home",
            page_data: { popular: { movies: popularMovies, shows: popularShows } },
            user: req.user
        });
    });

    // /home and /index should point to root
    server.get('/home', (req, res) => res.redirect(302, '/'));
    server.get('/index', (req, res) => res.redirect(302, '/'));
    // Remove /temp-home route (page now lives at '/')

    server.get('/temp-user', async function(req, res) {
        res.render('public assets/template.ejs', {
            page_title: "iWatched.xyz - Temp User",
            page_file: "temp_user",
            user: req.user
        });
    });

    // (Removed: /ap shortcut was unnecessary)
}
