#!/usr/bin/env node
/*
 Recalculate user_show_totals.total_seasons_watched from user_shows documents,
 counting seasons that are completed (date_completed set). For shows that are
 marked fully watched but lack season entries, we use TMDB to count all
 non-special seasons if a TMDB API key is available.

 Usage:
   node bin/tools/recalc_user_show_seasons.js <user_id_or_custom_or_username> [--apply]
*/
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

let tmdService = null;
try {
  const MovieDb = require('moviedb-promise');
  if (process.env.TMDB_API_KEY && String(process.env.TMDB_API_KEY).trim()) {
    tmdService = new MovieDb(process.env.TMDB_API_KEY);
  }
} catch(_) { tmdService = null; }

function oidMaybe(s){ return /^[0-9a-fA-F]{24}$/.test(String(s||'')); }
async function resolveMongoUri(){
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  try { const S = require(path.join(process.cwd(),'bin/server/config/serverSettings')); const ss = new S(); if (ss && ss._mongoDB) return ss._mongoDB; } catch(_){}
  return 'mongodb://127.0.0.1:27017/iwatched';
}

async function countSeasonsFromTmdb(showId){
  try {
    if (!tmdService) return 0;
    const info = await tmdService.tvInfo({ id: showId }).catch(()=>null);
    const seasons = (info && Array.isArray(info.seasons)) ? info.seasons : [];
    return seasons.filter(s => typeof s.season_number === 'number' && s.season_number !== 0).length;
  } catch (_) { return 0; }
}

async function main(){
  const arg = process.argv[2]; const apply = process.argv.includes('--apply');
  if (!arg){ console.error('Usage: node bin/tools/recalc_user_show_seasons.js <user> [--apply]'); process.exit(1); }
  const mongo = await resolveMongoUri();
  await mongoose.connect(mongo, { useNewUrlParser: true, useUnifiedTopology: true });
  const User = require(path.join(process.cwd(),'db/models/user'));
  const UserShow = require(path.join(process.cwd(),'db/models/userShow'));
  const Totals = require(path.join(process.cwd(),'db/models/userShowTotals'));

  let user = null; if (oidMaybe(arg)) user = await User.findById(arg).lean();
  if (!user) user = await User.findOne({ 'profile.custom_url': arg }).lean();
  if (!user) user = await User.findOne({ 'local.username': arg }).lean();
  if (!user){ console.error('User not found'); process.exit(2); }

  const docs = await UserShow.find({ user_id: user._id }).lean();
  let total = 0;
  for (const d of (docs||[])){
    const completed = Array.isArray(d.seasons) ? d.seasons.filter(s => !!s && !!s.date_completed && Number(s.season_number) !== 0).length : 0;
    if (completed > 0) { total += completed; continue; }
    // If entire show is watched but no season completion entries, attempt TMDB fallback
    const watched = ((d.show_watched_count||0) > 0) || !!d.show_watched;
    if (watched){ total += await countSeasonsFromTmdb(String(d.show_id)); }
  }

  let totals = await Totals.findOne({ user_id: user._id });
  if (!totals){ totals = new Totals(); totals.initial(user._id); }
  console.log('Current totals.total_seasons_watched =', totals.total_seasons_watched||0);
  console.log('Recomputed total_seasons_watched   =', total);
  if (apply){
    totals.total_seasons_watched = total;
    await totals.save();
    console.log('Applied.');
  } else {
    console.log('Dry-run. Add --apply to persist.');
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
