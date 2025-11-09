#!/usr/bin/env node
/*
 Recalculate user_show_totals.unique_shows_watched from user_shows documents
 using the same strict watched criteria used by the app. Optionally
 recompute episodes/runtime when TMDB key is present.

 Usage:
   node bin/tools/recalc_user_show_totals.js <user_id_or_custom_or_username> [--apply]
*/
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const MovieDb = require('moviedb-promise');

function oidMaybe(s){ return /^[0-9a-fA-F]{24}$/.test(String(s||'')); }
async function resolveMongoUri(){
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  try { const S = require(path.join(process.cwd(),'bin/server/config/serverSettings')); const ss = new S(); if (ss && ss._mongoDB) return ss._mongoDB; } catch(_){}
  return 'mongodb://127.0.0.1:27017/iwatched';
}

async function main(){
  const arg = process.argv[2]; const apply = process.argv.includes('--apply');
  if (!arg){ console.error('Usage: node bin/tools/recalc_user_show_totals.js <user> [--apply]'); process.exit(1); }
  const mongo = await resolveMongoUri();
  await mongoose.connect(mongo, {});
  const User = require(path.join(process.cwd(),'db/models/user'));
  const UserShow = require(path.join(process.cwd(),'db/models/userShow'));
  const Totals = require(path.join(process.cwd(),'db/models/userShowTotals'));

  let user = null; if (oidMaybe(arg)) user = await User.findById(arg).lean();
  if (!user) user = await User.findOne({ 'profile.custom_url': arg }).lean();
  if (!user) user = await User.findOne({ 'local.username': arg }).lean();
  if (!user){ console.error('User not found'); process.exit(2); }

  const watchedDocs = await UserShow.find({
    user_id: user._id,
    $or: [
      { show_watched_count: { $gt: 0 } },
      { show_watched: { $ne: null } },
      { seasons: { $elemMatch: { date_completed: { $ne: null } } } }
    ]
  }).lean();
  const uniqueCount = Array.from(new Set((watchedDocs||[]).map(d => String(d.show_id)))).length;
  let totals = await Totals.findOne({ user_id: user._id });
  if (!totals){ totals = new Totals(); totals.initial(user._id); }
  console.log('Current totals.unique_shows_watched =', totals.unique_shows_watched||0);
  console.log('Recomputed unique_shows_watched   =', uniqueCount);
  if (apply){
    totals.unique_shows_watched = uniqueCount;
    await totals.save();
    console.log('Applied.');
  } else {
    console.log('Dry-run. Add --apply to persist.');
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });


