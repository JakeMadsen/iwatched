(function(){
  function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80); }

  // Render a Recent Timeline showcase instance into a container
  window.renderRecentTimeline = function(opts){
    opts = opts || {}; var user_id = opts.userId; var containerId = opts.containerId || 'movies_holder'; var mode = String(opts.mode||'mixed'); var count = Number(opts.count)||12;
    var $holder = $('#'+containerId);
    try { $holder.empty(); } catch(_){ }
    var url = (mode === 'movies_only')
      ? ('/api/v1/user-movies/latest/' + encodeURIComponent(user_id))
      : (mode === 'shows_only')
        ? ('/api/v1/user-shows/latest/' + encodeURIComponent(user_id))
        : ('/api/v1/user-activity/latest/' + encodeURIComponent(user_id));
    fetch(url)
      .then(function(r){ return r.ok ? r.json() : { results: [] }; })
      .then(function(data){
        var raw = Array.isArray(data.results) ? data.results : [];
        var items = [];
        if (mode === 'movies_only'){
          items = (raw||[]).map(function(m){ return { type:'movie', tmd_id: m.tmd_id, movie_title: m.movie_title, poster_path: m.poster_path||null }; });
        } else if (mode === 'shows_only'){
          items = (raw||[]).map(function(s){ return { type:'show', tmd_id: s.tmd_id, show_title: s.show_title, poster_path: s.poster_path||null }; });
        } else {
          items = raw || [];
        }

        var tplMovie = $('#movie-template').html();
        var tplShow  = $('#show-template').html();
        var sliced = items.slice(0, Math.max(1, Math.min(count, 12)));
        var html = sliced.map(function(it){
          try {
            if (it.type === 'movie') { it.slug = slugify(it.movie_title||''); return micro(tplMovie, { tmd_id: it.tmd_id, movie_title: it.movie_title, slug: it.slug }); }
            else { it.slug = slugify(it.show_title||''); return micro(tplShow, { tmd_id: it.tmd_id, show_title: it.show_title, slug: it.slug }); }
          } catch(_) { return ''; }
        }).join('');
        var $items = $(html); $holder.append($items);
        // Always reflect the VIEWER's quick-action state (not the profile owner's).
        try {
          var viewerId = (window.SITE_PREFS && SITE_PREFS.userId) || null;
          var idsMovie = sliced.filter(function(x){return x.type==='movie';}).map(function(x){return x.tmd_id;});
          var idsShow  = sliced.filter(function(x){return x.type==='show';}).map(function(x){return x.tmd_id;});
          var $root = $('#'+containerId);
          // Hide both variants within this container only (supports duplicates across showcases)
          idsMovie.forEach(function(id){ $root.find("[id='add_watched_movie_"+id+"'],[id='remove_watched_movie_"+id+"'],[id='add_favourited_movie_"+id+"'],[id='remove_favourited_movie_"+id+"'],[id='add_saved_movie_"+id+"'],[id='remove_saved_movie_"+id+"']").hide(); });
          idsShow.forEach(function(id){ $root.find("[id='add_watched_show_"+id+"'],[id='remove_watched_show_"+id+"'],[id='add_favourited_show_"+id+"'],[id='remove_favourited_show_"+id+"'],[id='add_saved_show_"+id+"'],[id='remove_saved_show_"+id+"']").hide(); });
          if (viewerId && window.StatusStore){
            if (idsMovie.length){ StatusStore.request('movie', idsMovie).then(function(list){ (list||[]).forEach(function(st, idx){ var id=idsMovie[idx]; if(!id) return; var $add=$root.find("[id='add_watched_movie_"+id+"']"); var $rem=$root.find("[id='remove_watched_movie_"+id+"']"); (st&&st.w===true?$rem:$add).show(); var $af=$root.find("[id='add_favourited_movie_"+id+"']"); var $rf=$root.find("[id='remove_favourited_movie_"+id+"']"); (st&&st.f===true?$rf:$af).show(); var $as=$root.find("[id='add_saved_movie_"+id+"']"); var $rs=$root.find("[id='remove_saved_movie_"+id+"']"); (st&&st.s===true?$rs:$as).show(); }); }); }
            if (idsShow.length){ StatusStore.request('show', idsShow).then(function(list){ (list||[]).forEach(function(st, idx){ var id=idsShow[idx]; if(!id) return; var $add=$root.find("[id='add_watched_show_"+id+"']"); var $rem=$root.find("[id='remove_watched_show_"+id+"']"); (st&&st.w===true?$rem:$add).show(); var $af=$root.find("[id='add_favourited_show_"+id+"']"); var $rf=$root.find("[id='remove_favourited_show_"+id+"']"); (st&&st.f===true?$rf:$af).show(); var $as=$root.find("[id='add_saved_show_"+id+"']"); var $rs=$root.find("[id='remove_saved_show_"+id+"']"); (st&&st.s===true?$rs:$as).show(); }); }); }
          } else {
            // Not logged in; always show "add" state (off)
            idsMovie.forEach(function(id){ $root.find("[id='add_watched_movie_"+id+"'],[id='add_favourited_movie_"+id+"'],[id='add_saved_movie_"+id+"']").show(); });
            idsShow.forEach(function(id){ $root.find("[id='add_watched_show_"+id+"'],[id='add_favourited_show_"+id+"'],[id='add_saved_show_"+id+"']").show(); });
          }
        } catch(_){}
        // Poster hydrate from client cache/queue
        try {
          var idsMovie = sliced.filter(function(x){return x.type==='movie';}).map(function(x){return x.tmd_id;});
          var idsShow  = sliced.filter(function(x){return x.type==='show';}).map(function(x){return x.tmd_id;});
          var tmd = 'https://image.tmdb.org/t/p/w342/';
          (idsMovie||[]).forEach(function(id){ var cached=null; try { if (window.PosterCache) cached = PosterCache.get('movie', id); } catch(_){} if (cached) $("[name='movie_id_"+id+"']").attr('src', tmd+cached); else PosterQueueMovie.enqueue(id); });
          (idsShow||[]).forEach(function(id){ var cached=null; try { if (window.PosterCache) cached = PosterCache.get('show', id); } catch(_){} if (cached) $("[name='show_id_"+id+"']").attr('src', tmd+cached); else PosterQueueShow.enqueue(id); });
        } catch(_){}
      })
      .catch(function(){ /* ignore */ });

    function micro(src, data){ return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function(match, key){ var v=data; key.split('.').forEach(function(p){ v=v[p]; }); return v; }); }

    // Concurrency-limited poster fetch queues
    var PosterQueueMovie = (function(){ var q=[],running=0,MAX=2,host=location.origin,ep='/api/v1/movies/get_poster/';
      function pump(){ if(running>=MAX) return; var id=q.shift(); if(!id) return; running++; fetch(host+ep+id).then(function(r){ return r.ok ? r.json() : {}; }).then(function(d){ if(d&&d.poster_path){ try{ if(window.PosterCache) PosterCache.put('movie',id,d.poster_path);}catch(_){} $("[name='movie_id_"+id+"']").attr('src','https://image.tmdb.org/t/p/w342/'+d.poster_path); } }).finally(function(){ running--; if(q.length) setTimeout(pump,0); }); }
      return { enqueue: function(id){ if(!id) return; q.push(id); setTimeout(pump,0); } };
    })();
    var PosterQueueShow = (function(){ var q=[],running=0,MAX=2,host=location.origin,ep='/api/v1/shows/get_poster/';
      function pump(){ if(running>=MAX) return; var id=q.shift(); if(!id) return; running++; fetch(host+ep+id).then(function(r){ return r.ok ? r.json() : {}; }).then(function(d){ if(d&&d.poster_path){ try{ if(window.PosterCache) PosterCache.put('show',id,d.poster_path);}catch(_){} $("[name='show_id_"+id+"']").attr('src','https://image.tmdb.org/t/p/w342/'+d.poster_path); } }).finally(function(){ running--; if(q.length) setTimeout(pump,0); }); }
      return { enqueue: function(id){ if(!id) return; q.push(id); setTimeout(pump,0); } };
    })();
  };

  // LEGACY: kept for older includes, renders default into #movies_holder
  window.profileLatestActivity = function(user_id){
    try { window.renderRecentTimeline({ userId: user_id, mode: 'mixed', containerId: 'movies_holder' }); } catch(_){}
  };
})();
