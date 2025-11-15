const RestrictedUrl = require('../../db/models/restrictedUrls')

const reservedRoutes = [
  'about','contact','movies','shows','login','logout','api','admin','user','support',
  'policy','policy/privacy','policy/terms-of-service','profile','search','static',
  'socket.io','favicon.ico'
];

const profanityList = [
  'fuck','shit','bitch','asshole','cunt','nigger','faggot','rape','porn','sex'
];

function normalizeSlug(value){
  if(!value) return '';
  return String(value).trim().toLowerCase();
}

function isReserved(slug){
  const s = normalizeSlug(slug);
  if(!s) return true; // disallow empty
  if(s.length < 3 || s.length > 32) return true;
  if(!/^[a-z0-9-]+$/.test(s)) return true;
  if(/^[-]+$/.test(s)) return true;
  // exact and top-level segment check
  if(reservedRoutes.includes(s)) return true;
  const top = s.split('/')[0];
  if(reservedRoutes.includes(top)) return true;
  return false;
}

function containsProfanity(slug){
  const s = normalizeSlug(slug);
  return profanityList.some(w => s.includes(w));
}

async function isInDb(slug){
  const found = await RestrictedUrl.findOne({ restricted_url: slug }).lean();
  return !!found;
}

async function validateCustomUrl(slug){
  const s = normalizeSlug(slug);
  if(isReserved(s)) return { ok: false, reason: 'reserved_or_invalid' };
  if(containsProfanity(s)) return { ok: false, reason: 'profanity' };
  if(await isInDb(s)) return { ok: false, reason: 'restricted' };
  return { ok: true };
}

async function seedReserved() {
  try {
    const existing = await RestrictedUrl.find({ restricted_url: { $in: reservedRoutes } })
      .select('restricted_url')
      .lean();
    const have = new Set((existing || []).map(x => x.restricted_url));
    const toInsert = reservedRoutes
      .filter(slug => !have.has(slug))
      .map(slug => ({
        restricted_url: slug,
        info: 'Reserved site route',
        reason: 'site_route'
      }));
    if (toInsert.length) {
      await RestrictedUrl.insertMany(toInsert);
    }
  } catch (_) {
    // best-effort only
  }
}

module.exports = {
  getOne: (value) => {
    return new Promise(function (resolve, reject ) {
      RestrictedUrl
        .findOne({restricted_url: value})
        .exec((error, url) => {
          if (error) return reject(error)
          if(!url) return resolve(null)
          resolve(url)
        })
    })
  },
  getAll: () => {
    return new Promise(function (resolve, reject ) {
      RestrictedUrl
        .find({})
        .exec((error,list) => {
          if (error) return reject(error)
          resolve(list)
        })
    })
  },
  create: (user_id, data) => {
    return new Promise (function( resolve, reject ) {
      RestrictedUrl
        .find({ name: data.name })
        .exec( (error, blacklisted ) => {
          if (error) return reject(error)
          if (blacklisted) return resolve(true)

          let newRestriction = new RestrictedUrl()
          newRestriction.initial(user_id, data.name, data.text, data.reason)
          newRestriction.save((error) => {
            if (error) return reject(error)
            resolve(true)
          })
        })
    })
  },
  checkUrl: (value) => {
    return new Promise(function (resolve, reject ) {
      RestrictedUrl
        .findOne({restricted_url: value})
        .exec((error, url) => {
          if (error) return reject(error)
          if(!url) return resolve(null)
          resolve(url)
        })
    })
  },
  validateCustomUrl,
  seedReserved,
}
