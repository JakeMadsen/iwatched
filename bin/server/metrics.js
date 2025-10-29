const os = require('os');

const BUCKETS = 60; // per-second buckets for last 60s
const state = {
  startTime: Date.now(),
  buckets: new Array(BUCKETS).fill(0),
  bucketTs: new Array(BUCKETS).fill(0),
  idx: 0,
  totals: { requests: 0, errors4xx: 0, errors5xx: 0, authFailures: 0 },
  latencies: [], // keep last 500
  // rolling per-minute buckets for the last 60 minutes (RPM + avg/hour)
  minuteBuckets: new Array(60).fill(0),
  minuteTs: new Array(60).fill(0),
  // per-endpoint counters (normalized path keys)
  endpoints: new Map(), // key -> { totals, secBuckets[60], secTs[60], minBuckets[60], minTs[60], method }
  // rolling set of unique visitors by IP over last 24h
  uniqueIp: new Map(), // ip -> lastSeenTs
};

function keyPath(method, path){
  try {
    const parts = String(path||'').split('?')[0].split('/').filter(Boolean);
    const norm = parts.map(seg => (/^[0-9]+$/.test(seg) || /^[0-9a-fA-F]{24}$/.test(seg)) ? ':id' : seg).join('/');
    return (method||'GET').toUpperCase() + ' /' + norm;
  } catch(_) { return (method||'GET').toUpperCase() + ' ' + (path||'/'); }
}

function record(durationMs, status, path, method){
  const now = Date.now();
  const sec = Math.floor(now/1000);
  const pos = sec % BUCKETS;
  if (state.bucketTs[pos] !== sec){
    state.bucketTs[pos] = sec;
    state.buckets[pos] = 0;
  }
  state.buckets[pos]++;
  state.totals.requests++;
  if (status >= 500) state.totals.errors5xx++;
  else if (status >= 400) state.totals.errors4xx++;
  if (status === 401 || status === 403 || /login/i.test(path||'')) state.totals.authFailures++;

  // Unique visitors by IP (24h window)
  try {
    const ip = (this && this.req && (this.req.headers['x-forwarded-for'] || this.req.ip || this.req.connection && this.req.connection.remoteAddress) || '')
                .toString().split(',')[0].trim();
    if (ip) state.uniqueIp.set(ip, now);
    // periodic cleanup on write
    if ((now % 1000) < 10) {
      const cutoff = now - 24*60*60*1000;
      for (const [k,v] of state.uniqueIp.entries()) { if (!v || v < cutoff) state.uniqueIp.delete(k); }
    }
  } catch(_){}

  state.latencies.push(durationMs);
  if (state.latencies.length > 500) state.latencies.shift();

   // minute bucket
   const min = Math.floor(now/60000);
   const mpos = min % 60;
   if (state.minuteTs[mpos] !== min){ state.minuteTs[mpos] = min; state.minuteBuckets[mpos] = 0; }
   state.minuteBuckets[mpos]++;

   // per-endpoint accounting for API routes only
   try {
     if (typeof path === 'string' && /\/api\//.test(path)){
       const key = keyPath(method, path);
       let ep = state.endpoints.get(key);
       if (!ep){
         ep = { totals: 0, secBuckets: new Array(60).fill(0), secTs: new Array(60).fill(0), minBuckets: new Array(60).fill(0), minTs: new Array(60).fill(0), method: (method||'GET').toUpperCase() };
         state.endpoints.set(key, ep);
       }
       // per-second
       const epos = sec % 60; if (ep.secTs[epos] !== sec){ ep.secTs[epos] = sec; ep.secBuckets[epos] = 0; }
       ep.secBuckets[epos]++;
       // per-minute
       const empos = min % 60; if (ep.minTs[empos] !== min){ ep.minTs[empos] = min; ep.minBuckets[empos] = 0; }
       ep.minBuckets[empos]++;
       ep.totals++;
     }
   } catch(_){}
}

function percentile(arr, p){
  if (!arr.length) return 0;
  const sorted = Array.from(arr).sort((a,b)=>a-b);
  const idx = Math.ceil((p/100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length-1, idx))];
}

function snapshot(mongoose){
  const now = Date.now();
  const sec = Math.floor(now/1000);
  // Sum buckets that are within last 1s for RPS, and avg over last 60s
  let last = 0, total = 0, activeBuckets = 0;
  for (let i=0;i<BUCKETS;i++){
    if (sec - state.bucketTs[i] <= 1) last += state.buckets[i];
    if (sec - state.bucketTs[i] < BUCKETS){ total += state.buckets[i]; activeBuckets++; }
  }
  const rps1 = last; // roughly current second
  const rpsAvg = activeBuckets ? (total/activeBuckets) : 0;
  // requests per minute (last 60s sum) and average per hour (avg of last 60 minutes)
  let rpm = 0, minActive = 0, minTotal = 0;
  const nowMin = Math.floor(now/60000);
  for (let i=0;i<60;i++){
    if (sec - state.bucketTs[i] < 60) rpm += state.buckets[i];
    if (nowMin - state.minuteTs[i] < 60){ minTotal += state.minuteBuckets[i]; minActive++; }
  }
  const avgPerHour = minActive ? Math.round(minTotal / minActive) : 0;

  const lat = state.latencies;
  const avgLat = lat.length ? (lat.reduce((a,b)=>a+b,0)/lat.length) : 0;
  const p95 = percentile(lat, 95), p50 = percentile(lat, 50);

  let db = { state: 'unknown', connections: 0, host: '' };
  try {
    if (mongoose && mongoose.connection){
      db.state = ['disconnected','connected','connecting','disconnecting'][mongoose.connection.readyState] || String(mongoose.connection.readyState);
      db.connections = (mongoose.connections||[]).length;
      db.host = (mongoose.connection && mongoose.connection.host) || '';
    }
  } catch(_){}

  return {
    uptimeSec: Math.floor((now - state.startTime)/1000),
    rps: { current: rps1, avg60s: Number(rpsAvg.toFixed(2)) },
    rpm: { last60s: rpm, avgPerHour: avgPerHour },
    errors: { e4xx: state.totals.errors4xx, e5xx: state.totals.errors5xx },
    authFailures: state.totals.authFailures,
    latencyMs: { avg: Number(avgLat.toFixed(1)), p50: Math.round(p50), p95: Math.round(p95) },
    db,
    system: { load: os.loadavg ? os.loadavg()[0] : 0, memFree: os.freemem ? os.freemem() : 0 },
    unique24h: state.uniqueIp.size
  };
}

function middleware(req, res, next){
  const start = process.hrtime();
  function onFinish(){
    res.removeListener('finish', onFinish);
    const diff = process.hrtime(start);
    const ms = Math.round((diff[0]*1e9 + diff[1]) / 1e6);
    // bind req into 'this' for record to access IP without changing signature
    record.call({ req }, ms, res.statusCode, req.path || req.originalUrl, req.method);
  }
  res.on('finish', onFinish);
  next();
}

function snapshotEndpoints(prefixes){
  const now = Date.now();
  const sec = Math.floor(now/1000);
  const min = Math.floor(now/60000);
  const arr = [];
  const list = Array.from(state.endpoints.entries());
  list.forEach(([key, ep]) => {
    // optional filtering by path prefixes
    if (Array.isArray(prefixes) && prefixes.length){
      const ok = prefixes.some(p => key.toLowerCase().includes(String(p).toLowerCase()));
      if (!ok) return;
    }
    let rps = 0; for(let i=0;i<60;i++){ if (sec - ep.secTs[i] <= 1) rps += ep.secBuckets[i]; }
    let rpm = 0; for(let i=0;i<60;i++){ if (sec - ep.secTs[i] < 60) rpm += ep.secBuckets[i]; }
    let minActive=0, minTotal=0; for(let i=0;i<60;i++){ if (min - ep.minTs[i] < 60){ minActive++; minTotal += ep.minBuckets[i]; } }
    const avgHour = minActive ? Math.round(minTotal/minActive) : 0;
    arr.push({ key, method: ep.method, totals: ep.totals, rps, rpm, avgPerHour: avgHour });
  });
  // Order by rpm desc
  arr.sort((a,b)=> b.rpm - a.rpm || b.totals - a.totals);
  return arr;
}

module.exports = { middleware, snapshot, snapshotEndpoints };
