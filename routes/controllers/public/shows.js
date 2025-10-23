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
        // No redirects: links are now generated with slugs across the app

        let credits = await tmdService.tvCredits(id).catch(() => ({ cast: [], crew: [] }));
        const videos = (show.videos && show.videos.results) ? show.videos.results : [];
        // Pick a sensible YouTube trailer key if available
        function chooseYoutubeKey(list){
            try {
                const arr = Array.isArray(list) ? list : [];
                // Only YT
                const yt = arr.filter(v => (v && String(v.site).toLowerCase() === 'youtube' && v.key));
                if (!yt.length) return null;
                // Prefer Official trailers
                const byScore = yt.map(v => {
                    const type = String(v.type||'').toLowerCase();
                    const name = String(v.name||'').toLowerCase();
                    let score = 0;
                    if (type === 'trailer') score += 5; else if (type === 'teaser') score += 3; else score += 1;
                    if (v.official) score += 3;
                    if (name.includes('trailer')) score += 1;
                    if (name.includes('official')) score += 1;
                    // Newer first
                    const date = v.published_at ? (new Date(v.published_at).getTime()||0) : 0;
                    return { v, score, date };
                }).sort((a,b)=> (b.score - a.score) || (b.date - a.date));
                return byScore[0] && byScore[0].v && byScore[0].v.key ? byScore[0].v.key : null;
            } catch (_) { return null; }
        }
        const youtube_key = chooseYoutubeKey(videos);
        const cast = credits.cast || [];
        const crew = credits.crew || [];
        // Prefer created_by for series creators; fall back to crew Director
        const creators = Array.isArray(show.created_by) && show.created_by.length ? show.created_by : crew.filter(c => c.job === 'Director');
        async function pickSimilarShows() {
            try {
                const base = show || {};
                const lang = base.original_language || '';
                const baseYear = ((base.first_air_date || '').toString().slice(0,4)) || null;
                const yearNum = baseYear ? Number(baseYear) : null;
                const eraStart = yearNum ? Math.max(1950, yearNum - 12) : null;
                const eraEnd = yearNum ? (yearNum + 12) : null;

                // Determine core genres to anchor (Sci-Fi & Fantasy 10765, Action & Adventure 10759)
                const genreIds = Array.isArray(base.genres) ? base.genres.map(g => g.id) : [];
                const coreGenres = [10765, 10759].filter(id => genreIds.includes(id));
                const withGenres = coreGenres.length ? coreGenres.join(',') : (genreIds.slice(0,3).join(',') || '10765');

                // Pull from multiple high-quality sources (sequential for clearer logging)
                

                let rec = { results: [] };
                try {
                    // moviedb-promise uses tvRecommend (singular) for tv/:id/recommendations
                    rec = await tmdService.tvRecommend({ id: id, language: 'en-US' });
                    
                } catch (e) {
                    
                }

                let sim = { results: [] };
                try {
                    sim = await tmdService.tvSimilar({ id: id, language: 'en-US' });
                    
                } catch (e) {
                    
                }

                // Build discover params without undefined keys to avoid client errors
                function buildParams(sortBy, page){
                    const p = {
                        with_genres: withGenres,
                        with_original_language: lang || 'en',
                        sort_by: sortBy,
                        include_adult: false,
                        page: page
                    };
                    if (eraStart) p['first_air_date.gte'] = `${eraStart}-01-01`;
                    if (eraEnd) p['first_air_date.lte'] = `${eraEnd}-12-31`;
                    return p;
                }

                let disc1 = { results: [] };
                try {
                    disc1 = await tmdService.discoverTv(buildParams('vote_count.desc', 1));
                    
                } catch (e) {
                    
                }

                let disc2 = { results: [] };
                try {
                    disc2 = await tmdService.discoverTv(buildParams('popularity.desc', 2));
                    
                } catch (e) {
                    
                }
                

                const recItems = (rec && rec.results) ? rec.results : [];
                const simItems = (sim && sim.results) ? sim.results : [];
                const discItems = [
                    ...((disc1 && disc1.results) ? disc1.results : []),
                    ...((disc2 && disc2.results) ? disc2.results : [])
                ];
                // Raw snapshots for troubleshooting (first 12 from each source)
                

                // Merge with weights: rec > sim > discover, no duplicates and exclude itself
                const weight = new Map();
                const addWeighted = (arr, w, acc, seen) => {
                    arr.forEach(it => {
                        if (!it || !it.id || it.id === Number(id)) return;
                        if (!seen.has(it.id)) {
                            seen.add(it.id);
                            weight.set(it.id, w);
                            acc.push(it);
                        }
                    });
                };
                const seen = new Set();
                const merged = [];
                addWeighted(recItems, 3, merged, seen);
                addWeighted(simItems, 2, merged, seen);
                addWeighted(discItems, 1, merged, seen);

                // Final filters
                const filtered = merged.filter(it => {
                    if (!it.poster_path) return false;
                    const g = Array.isArray(it.genre_ids) ? it.genre_ids : [];
                    const isAnimated = g.includes(16);
                    const isReality = g.includes(10764) || g.includes(10767) || g.includes(10766);
                    if (isAnimated || isReality) return false;
                    if (lang === 'en') {
                        if (it.original_language && it.original_language !== 'en') {
                            const oc = Array.isArray(it.origin_country) ? it.origin_country : [];
                            if (!oc.some(c => ['US','GB','CA','AU'].includes(c))) return false;
                        }
                    } else if (lang && it.original_language && it.original_language !== lang) {
                        return false;
                    }
                    // If base is Sci-Fi/Action, prefer those when possible
                    if (coreGenres.length) {
                        const likely = coreGenres.some(x => g.includes(x));
                        if (!likely) return false;
                    }
                    return true;
                });

                // Preserve original source order: rec -> sim -> discover
                // Keep up to 60 items max; caller will choose how many to show initially
                const all = filtered.slice(0, 60);
                
                return all;
            } catch (_) {
                return (show.similar && show.similar.results) ? show.similar.results.slice(0,12) : [];
            }
        }
        const similar_all = await pickSimilarShows();
        const similar = similar_all.slice(0, 12);
        

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
                youtube_key: youtube_key,
                cast: cast,
                creators: creators,
                similar: similar,
                similar_all: similar_all,
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
