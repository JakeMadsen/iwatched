const mongoose = require('mongoose');
const User = require('../../db/models/user');
const UserMovie = require('../../db/models/userMovie');
const UserShow = require('../../db/models/userShow');
const UserMovieTotals = require('../../db/models/userMovieTotals');
const UserShowTotals = require('../../db/models/userShowTotals');
const Movie = require('../../db/models/movie');
const UserStats = require('../../db/models/userStats');
const moviesService = require('./movies');

async function getUserByIdOrSlug(idOrSlug){
    const id = String(idOrSlug || '');
    if (!id) return null;
    if (mongoose.Types.ObjectId.isValid(id)){
        const u = await User.findById(id).lean();
        if (u) return u;
    }
    // Try custom_url exact match, then case-insensitive
    const exact = await User.findOne({ 'profile.custom_url': id }).lean();
    if (exact) return exact;
    try {
        const rx = new RegExp('^' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
        return await User.findOne({ 'profile.custom_url': rx }).lean();
    } catch (_) {
        return null;
    }
}

async function getLatestSourceTimestamp(userId){
    const uid = mongoose.Types.ObjectId(userId);
    const [movieAgg, showAgg] = await Promise.all([
        UserMovie.aggregate([
            { $match: { user_id: uid } },
            { $group: { _id: null, last: { $max: '$date_updated' } } }
        ]),
        UserShow.aggregate([
            { $match: { user_id: uid } },
            { $group: { _id: null, last: { $max: '$date_updated' } } }
        ])
    ]).catch(() => [null, null]);
    const lastMovie = movieAgg && movieAgg[0] && movieAgg[0].last ? new Date(movieAgg[0].last) : null;
    const lastShow = showAgg && showAgg[0] && showAgg[0].last ? new Date(showAgg[0].last) : null;
    const ts = Math.max(
        lastMovie ? lastMovie.getTime() : 0,
        lastShow ? lastShow.getTime() : 0
    );
    return ts > 0 ? new Date(ts) : null;
}

function minsToText(mins){
    const m = Math.max(0, Math.floor(Number(mins || 0)));
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    const r = m % 60;
    return `${d} ${d===1?'day':'days'} and ${h} ${h===1?'hour':'hours'} and ${r} minutes`;
}

async function computeStatsForUser(user){
    const userId = user._id;
    const [movieTotals, showTotals] = await Promise.all([
        UserMovieTotals.findOne({ user_id: userId }).lean().catch(()=>null),
        UserShowTotals.findOne({ user_id: userId }).lean().catch(()=>null)
    ]);

    const moviesBlock = {
        unique_movies_watched: movieTotals && typeof movieTotals.unique_movies_watched === 'number' ? movieTotals.unique_movies_watched : 0,
        total_movies_watched: movieTotals && typeof movieTotals.total_movies_watched === 'number' ? movieTotals.total_movies_watched : 0,
        total_runtime_minutes: movieTotals && typeof movieTotals.total_runtime === 'number' ? movieTotals.total_runtime : 0
    };
    moviesBlock.rewatches_logged = Math.max(0, (moviesBlock.total_movies_watched || 0) - (moviesBlock.unique_movies_watched || 0));
    moviesBlock.total_runtime_text = minsToText(moviesBlock.total_runtime_minutes);

    const showsBlock = {
        unique_shows_watched: showTotals && typeof showTotals.unique_shows_watched === 'number' ? showTotals.unique_shows_watched : 0,
        total_seasons_watched: showTotals && typeof showTotals.total_seasons_watched === 'number' ? showTotals.total_seasons_watched : 0,
        total_episodes_watched: showTotals && typeof showTotals.total_episodes_watched === 'number' ? showTotals.total_episodes_watched : 0,
        total_runtime_minutes: showTotals && typeof showTotals.total_runtime === 'number' ? showTotals.total_runtime : 0
    };
    showsBlock.total_runtime_text = minsToText(showsBlock.total_runtime_minutes);

    // Favorite / most rewatched movie based on UserMovie
    const movieDocs = await UserMovie.find({ user_id: userId, movie_watched_count: { $gt: 0 } })
        .select('movie_id movie_watched_count personal_rating movie_runtime')
        .lean()
        .catch(()=>[]);

    let favoriteMovieDoc = null;
    let mostRewatchedDoc = null;
    for (const d of movieDocs){
        if (!favoriteMovieDoc){
            favoriteMovieDoc = d;
        } else {
            const cur = Number(d.personal_rating || 0);
            const best = Number(favoriteMovieDoc.personal_rating || 0);
            if (cur > best) favoriteMovieDoc = d;
            else if (cur === best){
                const cW = Number(d.movie_watched_count || 0);
                const bW = Number(favoriteMovieDoc.movie_watched_count || 0);
                if (cW > bW) favoriteMovieDoc = d;
            }
        }
        if (!mostRewatchedDoc){
            mostRewatchedDoc = d;
        } else {
            const cW = Number(d.movie_watched_count || 0);
            const bW = Number(mostRewatchedDoc.movie_watched_count || 0);
            if (cW > bW) mostRewatchedDoc = d;
        }
    }

    let moviesMetaMap = new Map();
    if (movieDocs.length){
        const movieIds = Array.from(new Set(movieDocs.map(d => String(d.movie_id || '')).filter(Boolean)));
        if (movieIds.length){
            // 1) Load cached movies
            let meta = await Movie.find({ tmd_id: { $in: movieIds } })
                .lean()
                .catch(()=>[]);
            moviesMetaMap = new Map((meta || []).map(m => [String(m.tmd_id), m]));

            // 2) Detect which IDs need enrichment (missing key fields)
            const needs = [];
            for (const id of movieIds){
                const m = moviesMetaMap.get(id);
                if (!m){
                    needs.push(id);
                    continue;
                }
                const hasRelease = !!m.release_date;
                const hasGenres = Array.isArray(m.genres) && m.genres.length > 0;
                const hasRuntime = typeof m.movie_runtime === 'number' && m.movie_runtime > 0;
                const hasPeople = Array.isArray(m.credits_actors) && m.credits_actors.length > 0 &&
                                  Array.isArray(m.credits_directors) && m.credits_directors.length > 0;
                if (!hasRelease || !hasGenres || !hasRuntime || !hasPeople){
                    needs.push(id);
                }
            }

            // 3) Enrich missing/incomplete entries from TMDB and persist
            for (const id of needs){
                try {
                    const info = await moviesService.getOneMovie(id);
                    if (!info) continue;
                    let doc = await Movie.findOne({ tmd_id: id });
                    if (!doc) doc = new Movie();
                    doc.initial(info);
                    try {
                        const cast = (info.credits && Array.isArray(info.credits.cast)) ? info.credits.cast : [];
                        const crew = (info.credits && Array.isArray(info.credits.crew)) ? info.credits.crew : [];
                        doc.credits_actors = cast.slice(0, 8).map(p => ({ id: p.id, name: p.name }));
                        doc.credits_directors = crew.filter(c => c.job === 'Director').slice(0, 5).map(p => ({ id: p.id, name: p.name }));
                    } catch(_){}
                    try { if (!doc.poster_path && info.poster_path) doc.poster_path = info.poster_path; } catch(_){}
                    await doc.save();
                    moviesMetaMap.set(id, doc.toObject());
                } catch(_){}
            }
        }
    }

    function buildMovieEntry(doc){
        if (!doc) return null;
        const m = moviesMetaMap.get(String(doc.movie_id || '')) || {};
        const runtime = Number(doc.movie_runtime || m.movie_runtime || 0) || 0;
        let year = null;
        try {
            if (m.release_date) {
                const y = parseInt(String(m.release_date).slice(0,4), 10);
                if (!isNaN(y)) year = y;
            }
        } catch(_){}
        return {
            tmdb_id: String(doc.movie_id || ''),
            title: m.movie_title || '',
            poster_path: m.poster_path || null,
            watch_count: Number(doc.movie_watched_count || 0),
            personal_rating: Number(doc.personal_rating || 0),
            runtime_minutes: runtime,
            year
        };
    }

    const favoriteMovie = buildMovieEntry(favoriteMovieDoc);
    const mostRewatchedMovie = buildMovieEntry(mostRewatchedDoc);

    // Aggregate movie genres, timeline, decades, people and extremes
    const genreCounts = new Map(); // name -> count
    let oldest = null; // { title, year }
    let newest = null;
    let pre2000 = 0; let post2000 = 0;
    const decadeCounts = new Map(); // label -> count
    const directorCounts = new Map(); // name -> count
    const actorCounts = new Map(); // name -> count
    let longest = null; // { title, runtime_minutes }
    let shortest = null;

    for (const d of movieDocs){
        const entry = buildMovieEntry(d);
        if (!entry) continue;
        const meta = moviesMetaMap.get(String(d.movie_id || '')) || {};

        // genres (only primary / first listed genre)
        const genres = Array.isArray(meta.genres) ? meta.genres : [];
        if (genres.length){
            const g = genres[0];
            const name = (g && g.name) || null;
            if (name){
                genreCounts.set(name, (genreCounts.get(name) || 0) + 1);
            }
        }

        // timeline + decades
        const year = entry.year;
        if (year && year > 1800 && year < 3000){
            if (!oldest || year < oldest.year) oldest = { title: entry.title, year };
            if (!newest || year > newest.year) newest = { title: entry.title, year };
            if (year < 2000) pre2000++; else post2000++;
            const decade = Math.floor(year / 10) * 10;
            const label = decade + 's';
            decadeCounts.set(label, (decadeCounts.get(label) || 0) + 1);
        }

        // directors / actors
        const dirs = Array.isArray(meta.credits_directors) ? meta.credits_directors : [];
        dirs.forEach(p => { if (p && p.name) directorCounts.set(p.name, (directorCounts.get(p.name) || 0) + 1); });
        const cast = Array.isArray(meta.credits_actors) ? meta.credits_actors.slice(0, 8) : [];
        cast.forEach(p => { if (p && p.name) actorCounts.set(p.name, (actorCounts.get(p.name) || 0) + 1); });

        // longest / shortest
        const rt = entry.runtime_minutes || 0;
        if (rt > 0){
            if (!longest || rt > longest.runtime_minutes){
                longest = { title: entry.title, runtime_minutes: rt };
            }
            if (!shortest || rt < shortest.runtime_minutes){
                shortest = { title: entry.title, runtime_minutes: rt };
            }
        }
    }

    // Build genre list (top 5 by count)
    const genresArr = Array.from(genreCounts.entries()).map(([name, count]) => ({ name, count }));
    genresArr.sort((a,b)=> b.count - a.count);
    const topGenres = genresArr.slice(0,5);
    const maxGenreCount = topGenres.length ? topGenres[0].count : 0;
    topGenres.forEach(g => { g.pct_of_top = maxGenreCount ? Math.round(g.count / maxGenreCount * 100) : 0; });

    // Timeline summary
    const totalTimeline = pre2000 + post2000;
    const timeline = {
        oldest_movie_watched: oldest || null,
        newest_release_watched: newest || null,
        pre2000: {
            count: pre2000,
            pct: totalTimeline ? Math.round(pre2000 / totalTimeline * 100) : 0
        },
        post2000: {
            count: post2000,
            pct: totalTimeline ? 100 - Math.round(pre2000 / totalTimeline * 100) : 0
        }
    };

    // Decades
    const decadesArr = Array.from(decadeCounts.entries()).map(([label, count]) => ({ label, count }));
    decadesArr.sort((a,b)=> {
        const aYear = parseInt(a.label,10) || 0;
        const bYear = parseInt(b.label,10) || 0;
        return aYear - bYear;
    });
    const maxDecadeCount = decadesArr.length ? decadesArr.reduce((m,x)=>Math.max(m,x.count),0) : 0;
    const favoriteDecade = decadesArr.length
        ? decadesArr.slice().sort((a,b)=> b.count - a.count)[0]
        : null;

    // Top directors / actors (top 5)
    function topPeople(map){
        const arr = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
        arr.sort((a,b)=> b.count - a.count);
        return arr.slice(0,5);
    }
    const topDirectors = topPeople(directorCounts);
    const topActors = topPeople(actorCounts);

    return {
        user_id: String(userId),
        profile: {
            username: (user.local && user.local.username) || '',
            custom_url: (user.profile && user.profile.custom_url) || null
        },
        movies: Object.assign({}, moviesBlock, {
            genres: topGenres,
            timeline,
            decades: decadesArr,
            favorite_decade: favoriteDecade,
            top_directors: topDirectors,
            top_actors: topActors,
            longest_movie: longest,
            shortest_movie: shortest
        }),
        shows: showsBlock,
        favorite_movie: favoriteMovie,
        most_rewatched_movie: mostRewatchedMovie
    };
}

async function getOrBuildUserStats(idOrSlug){
    const user = await getUserByIdOrSlug(idOrSlug);
    if (!user) return { user: null, stats: null };

    const latestSourceTs = await getLatestSourceTimestamp(user._id);

    let cached = await UserStats.findOne({ user_id: user._id }).lean().catch(()=>null);
    let needsRebuild = false;
    if (!cached || !cached.data){
        needsRebuild = true;
    } else {
        const hasSourceTs = !!cached.source_last_seen_at;
        const staleByTime = latestSourceTs && (!hasSourceTs || (new Date(latestSourceTs).getTime() > new Date(cached.source_last_seen_at).getTime()));
        const moviesBlock = cached.data && cached.data.movies;
        // Schema upgrade: if newer fields like genres are missing, force rebuild once
        const missingNewFields = !moviesBlock || typeof moviesBlock.genres === 'undefined' || typeof moviesBlock.timeline === 'undefined';
        needsRebuild = staleByTime || missingNewFields;
    }

    if (!needsRebuild && cached && cached.data){
        return { user, stats: cached.data };
    }

    const data = await computeStatsForUser(user);
    const toSave = {
        user_id: user._id,
        data,
        generated_at: new Date(),
        source_last_seen_at: latestSourceTs || new Date()
    };
    await UserStats.findOneAndUpdate(
        { user_id: user._id },
        { $set: toSave },
        { upsert: true, new: true }
    ).catch(()=>{});

    return { user, stats: data };
}

module.exports = {
    getOrBuildUserStats
};
