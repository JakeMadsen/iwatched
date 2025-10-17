const os = require('os');

const BUCKETS = 60; // per-second buckets for last 60s
const state = {
  startTime: Date.now(),
  buckets: new Array(BUCKETS).fill(0),
  bucketTs: new Array(BUCKETS).fill(0),
  idx: 0,
  totals: { requests: 0, errors4xx: 0, errors5xx: 0, authFailures: 0 },
  latencies: [], // keep last 500
};

function record(durationMs, status, path){
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

  state.latencies.push(durationMs);
  if (state.latencies.length > 500) state.latencies.shift();
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
    errors: { e4xx: state.totals.errors4xx, e5xx: state.totals.errors5xx },
    authFailures: state.totals.authFailures,
    latencyMs: { avg: Number(avgLat.toFixed(1)), p50: Math.round(p50), p95: Math.round(p95) },
    db,
    system: { load: os.loadavg ? os.loadavg()[0] : 0, memFree: os.freemem ? os.freemem() : 0 }
  };
}

function middleware(req, res, next){
  const start = process.hrtime();
  function onFinish(){
    res.removeListener('finish', onFinish);
    const diff = process.hrtime(start);
    const ms = Math.round((diff[0]*1e9 + diff[1]) / 1e6);
    record(ms, res.statusCode, req.path || req.originalUrl);
  }
  res.on('finish', onFinish);
  next();
}

module.exports = { middleware, snapshot };

