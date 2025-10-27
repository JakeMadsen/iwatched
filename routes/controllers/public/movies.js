// const tmdService = require('../../services/themoviedatabase')
const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da');

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

    async function handleMovieDetail(req, res){
        // Collapse details via append_to_response to reduce calls, then fetch credits
        const rawId = req.params.id;
        const id = parseNumericId(rawId);
        let movie = await tmdService.movieInfo({ id: id, append_to_response: 'videos,similar' })
            .catch(() => ({}));
        // No redirects: links are now generated with slugs across the app

        // Ignore rumored titles site-wide
        try {
            if (String(movie && movie.status || '').toLowerCase() === 'rumored') {
                return res.redirect(302, '/movies');
            }
        } catch(_){}

        let credits = await tmdService.movieCredits(id).catch(() => ({ cast: [], crew: [] }));
        let runtime = getRunTime(movie.runtime || 0);
        const videos = (movie.videos && movie.videos.results) ? movie.videos.results : [];
        async function gatherSimilarAll(){
            try {
                const base = movie || {};
                const baseGenres = Array.isArray(base.genres) ? base.genres.map(g=>g.id) : [];
                const lang = base.original_language || '';
                function notDoc(it){ const ids = Array.isArray(it && it.genre_ids) ? it.genre_ids : []; return !ids.includes(99); }
                const byId = new Map();
                function pushList(list){ (list||[]).forEach(it=>{ if(!it) return; const sid=String(it.id); if (sid===String(id)) return; if(!byId.has(sid)) byId.set(sid, it); }); }
                // Recommendations and similar
                let rec = await tmdService.movieRecommendations({ id: id }).catch(()=>({ results: [] }));
                pushList(rec && rec.results);
                pushList(movie && movie.similar && movie.similar.results);
                let items = Array.from(byId.values());
                // If low count, broaden with discover by shared genres
                if (items.length < 36 && baseGenres.length){
                    for (let page=1; page<=3 && items.length<36; page++){
                        try {
                            const disc = await tmdService.discoverMovie({ with_genres: baseGenres.join(','), sort_by:'popularity.desc', page }).catch(()=>({ results: [] }));
                            pushList(disc && disc.results);
                        } catch(_){}
                    }
                    items = Array.from(byId.values());
                }
                // Filter and score
                items = items.filter(it => {
                    if (!it) return false;
                    if (!notDoc(it)) return false;
                    if (!it.release_date) return false;
                    if ((it.vote_count||0) < 50) return false;
                    if (lang && it.original_language && it.original_language !== lang) return true; // allow cross-language in fallback
                    return true;
                });
                items.forEach(it => {
                    const overlap = Array.isArray(it.genre_ids) ? it.genre_ids.filter(g => baseGenres.includes(g)).length : 0;
                    const score = (overlap*2) + ((it.vote_average||0)/2) + (it.popularity||0)/100;
                    it.__score = score;
                });
                items.sort((a,b)=> (b.__score||0) - (a.__score||0));
                return items.slice(0, 36);
            } catch (_) { return (movie.similar && movie.similar.results) ? movie.similar.results.slice(0,36) : []; }
        }
        const similar_all = await gatherSimilarAll();
        const similar = similar_all.slice(0, 12);
        const cast = credits.cast || [];
        const crew = credits.crew || [];
        const directors = crew.filter(c => (c.job === 'Director'));

        res.render('public assets/template.ejs', {
            page_title: `iWatched - ${movie.title}`,
            page_file: "movies",
            page_subFile: "one",
            page_data: {
                movie: movie,
                movie_videos: videos,
                runtime:  runtime,
                similar: similar,
                similar_all: similar_all,
                cast: cast,
                directors: directors
            },
            user: req.user
        });
    }

    // Order matters: slugged route first to avoid :id catching it
    server.get('/movies/:id-:slug', handleMovieDetail);
    server.get('/movies/:id', handleMovieDetail);

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

function slugify(str){
    if(!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80);
}

function parseNumericId(idParam){
    const s = String(idParam || '');
    const m = s.match(/^\d+/);
    return m ? m[0] : s;
}
