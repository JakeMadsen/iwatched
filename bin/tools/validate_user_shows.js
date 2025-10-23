#!/usr/bin/env node
/*
 Quick auditor for a user's TV show stats.
 - Compares user_show_totals vs live user_shows docs
 - Reconstructs episodes/minutes from completed seasons (TMDB)
 - Highlights mismatches and edge cases (bookmarked-only, dup docs, etc.)

 Usage:
   node bin/tools/validate_user_shows.js <user_id_or_custom_url_or_username>

 Env:
   MONGO_URI (optional, falls back to server settings or local mongo)
   TMDB_API_KEY (required for season runtime reconstruction)
*/

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const MovieDb = require('moviedb-promise');

async function resolveMongoUri(){
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  try {
    const ServerSettings = require(path.join(process.cwd(), 'bin/server/config/serverSettings'));
    const settings = new ServerSettings();
    if (settings && settings._mongoDB) return settings._mongoDB;
  } catch(_){}
  return 'mongodb://127.0.0.1:27017/iwatched';
}

function oidMaybe(s){ return /^[0-9a-fA-F]{24}$/.test(String(s||'')); }

function minutesToText(mins){
  mins = Math.max(0, Math.floor(Number(mins||0)));
  const d = Math.floor(mins/1440), h=Math.floor((mins%1440)/60), m=mins%60;
  return `${d} ${d===1?'day':'days'} and ${h} ${h===1?'hour':'hours'} and ${m} minutes`;
}

async function main(){
  const arg = process.argv[2];
  if (!arg){
    console.error('Usage: node bin/tools/validate_user_shows.js <user_id_or_custom_url_or_username>');
    process.exit(1);
  }

  const mongoUri = await resolveMongoUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

  const User = require(path.join(process.cwd(),'db/models/user'));
  const UserShow = require(path.join(process.cwd(),'db/models/userShow'));
  const UserShowTotals = require(path.join(process.cwd(),'db/models/userShowTotals'));
  const Show = require(path.join(process.cwd(),'db/models/show'));

  // Resolve user
  let user = null;
  if (oidMaybe(arg)) user = await User.findById(arg).lean();
  if (!user) user = await User.findOne({ 'profile.custom_url': arg }).lean();
  if (!user) user = await User.findOne({ 'local.username': arg }).lean();
  if (!user){ console.error('User not found for:', arg); process.exit(2); }

  let tmd = null;
  if (process.env.TMDB_API_KEY && String(process.env.TMDB_API_KEY).trim()){
    try { tmd = new MovieDb(process.env.TMDB_API_KEY); }
    catch (e) { console.warn('Warning: TMDB init failed, skipping reconstruction:', e && e.message ? e.message : e); }
  } else {
    console.warn('Warning: TMDB_API_KEY not set. Skipping runtime/episodes reconstruction.');
  }

  // Watched docs (exclude bookmark-only)
  const watchedDocs = await UserShow.find({
    user_id: user._id,
    $or: [
      { show_watched_count: { $gt: 0 } },
      { show_watched: { $ne: null } },
      { seasons: { $elemMatch: { date_completed: { $ne: null } } } }
    ]
  }).lean();

  const uniqueShowIds = Array.from(new Set((watchedDocs||[]).map(d => String(d.show_id))));
  const totals = await UserShowTotals.findOne({ user_id: user._id }).lean();

  async function seasonMinutes(showId, seasonNumber, avgEp){
    try {
      if (!tmd) return { episodes: 0, minutes: 0 };
      const s = await tmd.tvSeasonInfo({ id: showId, season_number: seasonNumber });
      const eps = Array.isArray(s.episodes)? s.episodes: [];
      let m = 0; eps.forEach(ep => { const rt = (typeof ep.runtime==='number'&&ep.runtime>0)? ep.runtime : (avgEp||0); m += (rt||0); });
      return { episodes: eps.length, minutes: m };
    } catch(_) { return { episodes: 0, minutes: 0 }; }
  }

  // Reconstruct episodes/minutes only from completed seasons (best-effort)
  let reconEpisodes = 0, reconMinutes = 0;
  if (tmd){
    for (const doc of watchedDocs){
      const sid = String(doc.show_id);
      const completed = (Array.isArray(doc.seasons)? doc.seasons : []).filter(s => !!s.date_completed).map(s => Number(s.season_number));
      if (!completed.length) continue;
      let avgEp = 0; try { const inf = await tmd.tvInfo({ id: sid }); avgEp = Array.isArray(inf.episode_run_time)&&inf.episode_run_time[0]? Number(inf.episode_run_time[0]): 0; } catch(_){}
      for (const sn of completed){ const st = await seasonMinutes(sid, sn, avgEp); reconEpisodes += st.episodes; reconMinutes += st.minutes; }
    }
  }

  // Output
  console.log('User:', user._id.toString(), '-', (user.local&&user.local.username)||'');
  console.log('Watched docs (excluding bookmark-only):', watchedDocs.length);
  console.log('Unique watched shows:', uniqueShowIds.length);
  console.log('Totals.unique_shows_watched:', totals ? totals.unique_shows_watched : 0);
  console.log('Delta (unique - totals):', uniqueShowIds.length - (totals?totals.unique_shows_watched:0));
  console.log('---');
  if (tmd){
    console.log('Reconstructed from completed seasons:');
    console.log('  Episodes:', reconEpisodes);
    console.log('  Minutes :', reconMinutes, `(${minutesToText(reconMinutes)})`);
  } else {
    console.log('Reconstructed from completed seasons: (skipped — no TMDB key)');
  }
  console.log('Totals from user_show_totals:');
  console.log('  Episodes:', totals ? totals.total_episodes_watched : 0);
  console.log('  Minutes :', totals ? totals.total_runtime : 0, totals?`(${minutesToText(totals.total_runtime)})`: '');
  if (tmd){
    console.log('Delta (totals - reconstructed):');
    console.log('  Episodes:', (totals?totals.total_episodes_watched:0) - reconEpisodes);
    console.log('  Minutes :', (totals?totals.total_runtime:0) - reconMinutes);
  }
  console.log('---');

  // Show list breakdown and anomalies
  const showDocs = await Show.find({ 'tmd_id': { $in: uniqueShowIds } }).lean();
  const have = new Set(showDocs.map(s => String(s.tmd_id)));
  const missingShows = uniqueShowIds.filter(id => !have.has(String(id)));
  if (missingShows.length){
    console.log('Missing show docs (present in user_shows but not in shows collection):', missingShows);
  }

  // Docs that are not counted as unique (dup) or appear bookmark-only (should be excluded already)
  const bookmarkOnly = (await UserShow.find({ user_id: user._id, show_bookmarked: { $ne: null }, show_watched: null, show_watched_count: { $in: [null, 0] }, seasons: { $not: { $elemMatch: { date_completed: { $ne: null } } } } }).lean()).map(d => d.show_id);
  if (bookmarkOnly.length){ console.log('Bookmark-only docs (excluded):', Array.from(new Set(bookmarkOnly)).length); }

  console.log('Done.');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
