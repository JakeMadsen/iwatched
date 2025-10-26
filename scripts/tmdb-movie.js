#!/usr/bin/env node
// Fetch TMDb movie or TV data by ID/slug/URL and highlight placeholder entries.

const url = "https://api.themoviedb.org/3";
const envKey = process.env.TMDB_API_KEY;
const key = (envKey && !/^your-tmdb-api-key$/i.test(envKey)) ? envKey : "ab4e974d12c288535f869686bd72e1da";

function inferMediaTypeFromInput(input) {
  const s = String(input).toLowerCase();
  if (/(^|\/)movies?(\/|$)/.test(s) || /(^|\/)movie(\/|$)/.test(s)) return 'movie';
  if (/(^|\/)shows?(\/|$)/.test(s) || /(^|\/)series(\/|$)/.test(s) || /(^|\/)tv(\/|$)/.test(s)) return 'tv';
  return 'auto';
}

function extractId(input) {
  if (!input) throw new Error("Provide a movie id, slug, or URL");
  const str = String(input).trim();
  // If it's a URL or path, pick the last path segment
  try {
    const u = new URL(str);
    const seg = u.pathname.split('/').filter(Boolean).pop() || '';
    const m = seg.match(/^(\d+)/);
    if (m) return m[1];
  } catch {}
  // Direct id or slug starting with id
  const m2 = str.match(/^(\d+)/);
  if (m2) return m2[1];
  // Fallback: find the first long-ish number
  const m3 = str.match(/(\d{3,})/);
  if (m3) return m3[1];
  throw new Error(`Could not parse TMDb id from: ${input}`);
}

async function getJson(u) {
  // Use global fetch if available; otherwise use https
  if (typeof fetch === 'function') {
    const r = await fetch(u, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return r.json();
  }
  const https = await import('node:https');
  return new Promise((resolve, reject) => {
    https.get.default(u, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function summarizeMovie(data) {
  const summary = {
    id: data.id,
    title: data.title,
    original_title: data.original_title,
    status: data.status, // Released, Rumored, Planned, In Production, Post Production, Canceled
    release_date: data.release_date,
    runtime: data.runtime,
    overview_len: (data.overview || '').length,
    has_poster: Boolean(data.poster_path),
    has_backdrop: Boolean(data.backdrop_path),
    vote_count: data.vote_count,
    vote_average: data.vote_average,
    popularity: Number.isFinite(Number(data.popularity)) ? Math.round(Number(data.popularity) * 100) / 100 : null,
    has_imdb: Boolean(data?.external_ids?.imdb_id),
    genres: Array.isArray(data.genres) ? data.genres.map(g => g.name).join(', ') : ''
  };

  const likely_placeholder = (
    summary.status !== 'Released' ||
    !summary.release_date ||
    Number(summary.runtime) === 0 ||
    summary.overview_len === 0 ||
    Number(summary.vote_count) < 1
  );

  return { media_type: 'movie', summary, likely_placeholder };
}

function summarizeTv(data) {
  const episodeRun = Array.isArray(data.episode_run_time) && data.episode_run_time.length ? data.episode_run_time.join('/') : '';
  const summary = {
    id: data.id,
    name: data.name,
    original_name: data.original_name,
    status: data.status, // Returning Series, Planned, In Production, Ended, Canceled, Pilot
    first_air_date: data.first_air_date,
    last_air_date: data.last_air_date,
    number_of_seasons: data.number_of_seasons,
    number_of_episodes: data.number_of_episodes,
    episode_run_time: episodeRun,
    overview_len: (data.overview || '').length,
    has_poster: Boolean(data.poster_path),
    has_backdrop: Boolean(data.backdrop_path),
    vote_count: data.vote_count,
    vote_average: data.vote_average,
    popularity: Number.isFinite(Number(data.popularity)) ? Math.round(Number(data.popularity) * 100) / 100 : null,
    has_imdb: Boolean(data?.external_ids?.imdb_id),
    genres: Array.isArray(data.genres) ? data.genres.map(g => g.name).join(', ') : '',
    type: data.type || '' // Reality, Scripted, etc.
  };

  const likely_placeholder = (
    !summary.first_air_date ||
    summary.overview_len === 0 ||
    Number(summary.vote_count) < 1 ||
    ['Planned', 'In Production', 'Pilot'].includes(summary.status)
  );

  const is_reality = summary.type === 'Reality' || (summary.genres || '').split(',').map(s => s.trim().toLowerCase()).includes('reality');

  return { media_type: 'tv', summary, likely_placeholder, is_reality };
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const jsonOut = flags.has('--json');
  const failOnIgnore = flags.has('--fail-on-ignore');
  const arg = args.find(a => !a.startsWith('--'));
  if (!arg) {
    console.error("Usage: node scripts/tmdb-movie.js [--json] [--fail-on-ignore] <id|slug|url>");
    process.exit(1);
  }

  const id = extractId(arg);
  const inferred = inferMediaTypeFromInput(arg);

  async function fetchMovie() {
    const u = `${url}/movie/${id}?api_key=${key}&language=en-US&append_to_response=release_dates,images,videos,credits,external_ids`;
    const data = await getJson(u);
    return summarizeMovie(data);
  }

  async function fetchTv() {
    const u = `${url}/tv/${id}?api_key=${key}&language=en-US&append_to_response=content_ratings,images,videos,aggregate_credits,external_ids`;
    const data = await getJson(u);
    return summarizeTv(data);
  }

  try {
    let out;
    if (inferred === 'movie') {
      out = await fetchMovie();
    } else if (inferred === 'tv') {
      out = await fetchTv();
    } else {
      // auto: try movie then tv
      try { out = await fetchMovie(); }
      catch (e) {
        // If TMDb returns not found, fallback to tv
        out = await fetchTv();
      }
    }

    // Compute ignore rules
    const reasons = [];
    if (String(out.summary.status || '').toLowerCase() === 'rumored') {
      reasons.push('status:rumored');
    }
    // Reality detection: only relevant for TV but keep a genre check for completeness
    const hasRealityGenre = String(out.summary.genres || '')
      .toLowerCase()
      .split(',')
      .map(s => s.trim())
      .includes('reality');
    const isReality = out.media_type === 'tv' ? (out.is_reality || hasRealityGenre) : hasRealityGenre;
    if (isReality) reasons.push('reality');
    const ignored = reasons.length > 0;

    const payload = { ...out, ignored, ignore_reasons: reasons };

    if (jsonOut) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log("summary:");
      Object.entries(out.summary).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });
      console.log(`likely_placeholder: ${out.likely_placeholder}`);
      if (out.media_type === 'tv') {
        console.log(`is_reality: ${out.is_reality}`);
      }
      console.log(`ignored: ${ignored}`);
      if (ignored) console.log(`ignore_reasons: ${reasons.join(', ')}`);
    }

    if (ignored && failOnIgnore) {
      process.exit(3);
    }
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(2);
  }
}

main();
