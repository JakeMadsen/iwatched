// const tmdService = require('../../services/themoviedatabase')
const MovieDb = require('moviedb-promise');
const tmdService = new MovieDb(process.env.TMDB_API_KEY || 'ab4e974d12c288535f869686bd72e1da')

module.exports = function (server) {
    console.log('* Show Routes Loaded Into Server');
    
    server.get('/shows', 
        async function(req, res) {
            const genres = await tmdService.genreTvList();
            res.render('public assets/template.ejs', {
                page_title: "iWatched - Series",
                page_file: "shows",
                page_subFile: "all",
                page_data: {
                    genres: (genres && genres.genres) ? genres.genres : []
                },
                user: req.user
            });
        }
    );

    async function handleShowDetail(req, res){
        const rawId = req.params.id;
        const id = parseNumericId(rawId);
        let show = await tmdService.tvInfo({ id: id, append_to_response: 'videos,similar' })
            .catch(() => ({}));
        // Redirect to canonical slugged URL if needed
        try {
            const wantSlug = slugify(show && show.name ? show.name : '');
            if (wantSlug) {
                const currentSlug = req.params.slug;
                if (currentSlug !== wantSlug) {
                    return res.redirect(302, `/shows/${id}-${wantSlug}`);
                }
            }
        } catch(e) { /* ignore */ }

        let credits = await tmdService.tvCredits(id).catch(() => ({ cast: [], crew: [] }));
        const videos = (show.videos && show.videos.results) ? show.videos.results : [];
        const cast = credits.cast || [];
        const crew = credits.crew || [];
        // Prefer created_by for series creators; fall back to crew Director
        const creators = Array.isArray(show.created_by) && show.created_by.length ? show.created_by : crew.filter(c => c.job === 'Director');
        const similar = (show.similar && show.similar.results) ? show.similar.results : [];

        // Fast estimate for total runtime (no extra API calls): avg episode runtime * number_of_episodes
        const avgEpRuntime = Array.isArray(show.episode_run_time) && show.episode_run_time.length ? Number(show.episode_run_time[0]) : 0;
        let estMinutes = 0;
        if (avgEpRuntime && show.number_of_episodes) {
            estMinutes = avgEpRuntime * Number(show.number_of_episodes);
        }
        const totalRuntimeMinutes = estMinutes;
        const totalRuntimeText = estMinutes ? minutesToDaysHours(estMinutes) : null;
        res.render('public assets/template.ejs', {
            page_title: `iWatched - ${show.name}`,
            page_file: "shows",
            page_subFile: "one",
            page_data: {
                show: show,
                show_videos: videos,
                cast: cast,
                creators: creators,
                similar: similar,
                total_runtime_minutes: totalRuntimeMinutes,
                total_runtime_text: totalRuntimeText,
                total_runtime_is_estimate: true
            },
            user: req.user
        });
    }

    // Order matters: slugged route first to avoid :id catching it
    server.get('/shows/:id-:slug', handleShowDetail);
    server.get('/shows/:id', handleShowDetail);

    // Season page: list seasons or show a specific season
    server.get('/shows/:id/season/:season_number?', async function(req, res) {
        const showId = req.params.id;
        const seasonNumber = req.params.season_number;
        let show = await tmdService.tvInfo({ id: showId }).catch(() => ({}));
        let season = null;
        let episodes = [];
        if (seasonNumber) {
            const s = await tmdService.tvSeasonInfo({ id: showId, season_number: seasonNumber, append_to_response: 'videos' }).catch(() => null);
            if (s) {
                season = s;
                episodes = Array.isArray(s.episodes) ? s.episodes : [];
            }
        }
        res.render('public assets/template.ejs', {
            page_title: `iWatched - ${show.name || 'Season'}`,
            page_file: 'shows',
            page_subFile: 'season',
            page_data: {
                show: show,
                season: season,
                season_number: seasonNumber || null,
                episodes: episodes
            },
            user: req.user
        });
    });
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

// Utility shared by route and API
function minutesToDaysHours(mins){
    mins = Math.max(0, Math.floor(Number(mins||0)));
    const days = Math.floor(mins / 1440);
    const hours = Math.floor((mins % 1440) / 60);
    const d = days + ' ' + (days === 1 ? 'day' : 'days');
    const h = hours + ' ' + (hours === 1 ? 'hour' : 'hours');
    return days > 0 ? (d + ' ' + h) : h;
}

// Lightweight cached API for precise total runtime (may require multiple TMDB calls)
const __runtimeCache = new Map(); // key -> { minutes, text, at }
const RUNTIME_TTL_MS = 24 * 60 * 60 * 1000;

module.exports.runtimeCache = __runtimeCache; // for potential introspection/tests

module.exports.attachRuntimeApi = function(server){
    server.get('/api/v1/shows/:id/runtime', async function(req, res){
        const id = parseNumericId(req.params.id);
        const key = 'show-runtime-' + id;
        const now = Date.now();
        const cached = __runtimeCache.get(key);
        if (cached && (now - cached.at) < RUNTIME_TTL_MS){
            return res.json({ minutes: cached.minutes, text: cached.text, cached: true });
        }
        try {
            const show = await tmdService.tvInfo({ id: id }).catch(() => ({}));
            const avgEpRuntime = Array.isArray(show.episode_run_time) && show.episode_run_time.length ? Number(show.episode_run_time[0]) : 0;
            const seasons = Array.isArray(show.seasons) ? show.seasons : [];
            const seasonNumbers = seasons.filter(s => typeof s.season_number === 'number' && s.season_number !== 0).map(s => s.season_number);
            const seasonPromises = seasonNumbers.map(sn => tmdService.tvSeasonInfo({ id: id, season_number: sn }).catch(() => null));
            const seasonDetails = await Promise.all(seasonPromises);
            let minutes = 0;
            seasonDetails.forEach(sd => {
                if (!sd) return;
                const eps = Array.isArray(sd.episodes) ? sd.episodes : [];
                eps.forEach(ep => {
                    const rt = typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : avgEpRuntime;
                    minutes += (rt || 0);
                });
            });
            if (minutes === 0 && avgEpRuntime && show.number_of_episodes){
                minutes = avgEpRuntime * Number(show.number_of_episodes);
            }
            const text = minutesToDaysHours(minutes);
            __runtimeCache.set(key, { minutes, text, at: now });
            return res.json({ minutes, text, cached: false });
        } catch (e){
            return res.status(500).json({ error: 'Failed to compute runtime' });
        }
    });
}
