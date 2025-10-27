// Lightweight client-side status cache + batcher for movie/show quick actions
(function(){
  if (window.StatusStore) return; // singleton

  var CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  var FLUSH_DELAY_MS = 80; // batch window
  var MAX_BATCH = 200;

  function now(){ return Date.now(); }

  function makeStore(){
    var cache = new Map(); // key -> { w:Boolean, f:Boolean, s:Boolean, ts:number }
    var queues = { movie: new Set(), show: new Set() };
    var timers = { movie: null, show: null };
    var inflight = { movie: false, show: false };
    var waiters = new Map(); // key -> [resolve]

    function key(type, id){ return type+':'+String(id); }

    function getCached(type, id){
      var k = key(type,id); var v = cache.get(k);
      if (!v) return null; if ((now() - (v.ts||0)) > CACHE_TTL_MS){ cache.delete(k); return null; }
      return v;
    }

    // Simple per-type LRU persisted in sessionStorage
    var persist = {
      load: function(type){
        try {
          var uid = (window.SITE_PREFS && SITE_PREFS.userId) || 'anon';
          var raw = sessionStorage.getItem('iw_status_'+uid+'_'+type);
          if(!raw) return;
          var obj = JSON.parse(raw||'{}');
          var tsNow = now();
          Object.keys(obj||{}).forEach(function(id){
            var v = obj[id];
            if (!v) return;
            if ((tsNow - (v.ts||0)) > CACHE_TTL_MS) return;
            cache.set(key(type,id), { w:!!v.w, f:!!v.f, s:!!v.s, ts: v.ts||tsNow });
          });
        } catch(_){}
      },
      save: function(type){
        try {
          var uid = (window.SITE_PREFS && SITE_PREFS.userId) || 'anon';
          // limit persisted entries per type to ~2000 to keep size safe
          var max = 2000, count = 0, out = {};
          var tsNow = now();
          // Prefer most recently touched by iterating keys and sorting by ts
          var items = [];
          cache.forEach(function(v,k){ if (k.indexOf(type+':')===0) items.push([k,v]); });
          items.sort(function(a,b){ return (b[1].ts||0) - (a[1].ts||0); });
          for (var i=0;i<items.length && count<max;i++){
            var k = items[i][0], v = items[i][1];
            if ((tsNow - (v.ts||0)) > CACHE_TTL_MS) continue;
            var id = k.split(':')[1]; out[id] = { w:!!v.w, f:!!v.f, s:!!v.s, ts:v.ts||tsNow }; count++;
          }
          sessionStorage.setItem('iw_status_'+uid+'_'+type, JSON.stringify(out));
        } catch(_){}
      }
    };

    // hydrate from sessionStorage
    try { persist.load('movie'); persist.load('show'); } catch(_){}

    function setCached(type, id, obj){
      cache.set(key(type,id), { w:!!obj.w, f:!!obj.f, s:!!obj.s, ts: now() });
      // persist debounced via save on next tick
      clearTimeout(setCached._t); setCached._t = setTimeout(function(){ try { persist.save(type); } catch(_){} }, 50);
    }

    function enqueue(type, ids){
      ids.forEach(function(id){
        if (!id && id!==0) return; var k = key(type,id);
        // resolve immediately from cache
        var c = getCached(type,id);
        if (c){ resolveWaiter(k, c); return; }
        queues[type].add(String(id));
        if (!timers[type]) timers[type] = setTimeout(function(){ flush(type); }, FLUSH_DELAY_MS);
      });
    }

    function resolveWaiter(k, value){
      var arr = waiters.get(k); if (!arr) return;
      arr.forEach(function(r){ try { r(value); } catch(_){} });
      waiters.delete(k);
    }

    function awaitOne(type, id){
      var k = key(type,id);
      var c = getCached(type,id);
      if (c) return Promise.resolve(c);
      return new Promise(function(resolve){
        var arr = waiters.get(k); if (!arr) arr = []; arr.push(resolve); waiters.set(k, arr);
        enqueue(type, [id]);
      });
    }

    function flush(type){
      timers[type] = null; if (inflight[type]) { return; }
      var list = Array.from(queues[type]); queues[type].clear();
      if (!list.length) return;
      // cap batch
      if (list.length > MAX_BATCH){ var tail = list.splice(MAX_BATCH); tail.forEach(function(id){ queues[type].add(id); }); }
      inflight[type] = true;
      var url = (type==='movie') ? '/api/v1/user-movies/status/bulk' : '/api/v1/user-shows/status/bulk';
      var body = { profile_id: (window.SITE_PREFS && SITE_PREFS.userId) || null, ids: list };
      fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body), cache:'no-cache', mode:'cors' })
        .then(function(r){ return r.ok ? r.json() : { statuses:{} }; })
        .then(function(data){
          var map = data.statuses || {};
          list.forEach(function(id){
            var st = map[String(id)] || { w:false, f:false, s:false };
            setCached(type, id, st);
            resolveWaiter(key(type,id), st);
          });
          try { maybeHideWatched(type, map); } catch(_){}
        })
        .catch(function(){
          // resolve as unknown to avoid hanging
          list.forEach(function(id){ resolveWaiter(key(type,id), { w:false, f:false, s:false }); });
        })
        .finally(function(){ inflight[type] = false; if (queues[type].size) flush(type); });
    }

    function maybeHideWatched(type, map){
      // Apply only on search/browse pages; never hide on user profile lists
      if (!(window.SITE_PREFS && SITE_PREFS.hideWatchedInSearch)) return;
      try {
        if (!document.getElementById('search_input')) return; // not a search UI
        var holder = (type==='movie') ? document.getElementById('movies_holder') : document.getElementById('shows_holder');
        if (!holder) return;
        Object.keys(map||{}).forEach(function(id){
          var st = map[id]; if (!st || !st.w) return;
          var el = holder.querySelector('[data-tmd-id="'+id+'"]');
          if (el) el.style.display = 'none';
        });
      } catch(_){}
    }

    return {
      // Public API
      request: function(type, ids){ enqueue(type, (ids||[]).map(String)); return Promise.all((ids||[]).map(function(id){ return awaitOne(type, id); })); },
      getOne: awaitOne,
      put: setCached
    };
  }

  window.StatusStore = makeStore();
})();
