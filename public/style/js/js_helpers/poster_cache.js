// Client-side poster path cache (localStorage + memory)
// Stores TMDb poster_path keyed by type ('movie'|'show') and TMDb id
(function(){
  if (window.PosterCache) return;

  var TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
  var MAX_ITEMS = 8000; // per-type safety cap

  function now(){ return Date.now(); }

  function make(){
    var mem = { movie: new Map(), show: new Map() };

    function load(type){
      try {
        var raw = localStorage.getItem('iw_poster_'+type);
        if (!raw) return;
        var obj = JSON.parse(raw||'{}');
        var ts = now();
        Object.keys(obj).forEach(function(id){
          var v = obj[id];
          if (!v) return;
          if ((ts - (v.ts||0)) > TTL_MS) return;
          mem[type].set(String(id), { p: v.p || null, ts: v.ts||ts });
        });
      } catch(_){}
    }
    function save(type){
      try {
        var arr = Array.from(mem[type].entries());
        // most recent first
        arr.sort(function(a,b){ return (b[1].ts||0) - (a[1].ts||0); });
        var out = {}; var count = 0; var ts = now();
        for (var i=0;i<arr.length && count<MAX_ITEMS;i++){
          var id = arr[i][0], v = arr[i][1];
          if ((ts - (v.ts||0)) > TTL_MS) continue;
          out[id] = { p: v.p || null, ts: v.ts || ts };
          count++;
        }
        localStorage.setItem('iw_poster_'+type, JSON.stringify(out));
      } catch(_){}
    }

    // init
    try { load('movie'); load('show'); } catch(_){}

    function get(type, id){
      try {
        var v = mem[type].get(String(id));
        if (!v) return null;
        if ((now() - (v.ts||0)) > TTL_MS){ mem[type].delete(String(id)); return null; }
        return v.p || null;
      } catch(_) { return null; }
    }
    function put(type, id, path){
      try {
        mem[type].set(String(id), { p: path || null, ts: now() });
        clearTimeout(put._t); put._t = setTimeout(function(){ try { save(type); } catch(_){} }, 50);
      } catch(_){}
    }

    return { get: get, put: put };
  }

  window.PosterCache = make();
})();

