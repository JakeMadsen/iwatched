(function(){
  function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80); }

  window.profileLatestActivity = function(user_id){
    var $holder = $('#movies_holder');
    try { $holder.empty(); } catch(_){ }
    var url = '/api/v1/user-activity/latest/' + encodeURIComponent(user_id);
    fetch(url)
      .then(function(r){ return r.ok ? r.json() : { results: [] }; })
      .then(function(data){
        var items = Array.isArray(data.results) ? data.results : [];
        var tplMovie = $('#movie-template').html();
        var tplShow  = $('#show-template').html();
        var html = items.map(function(it){
          try {
            if (it.type === 'movie') { it.slug = slugify(it.movie_title||''); return micro(tplMovie, { tmd_id: it.tmd_id, movie_title: it.movie_title, slug: it.slug }); }
            else { it.slug = slugify(it.show_title||''); return micro(tplShow, { tmd_id: it.tmd_id, show_title: it.show_title, slug: it.slug }); }
          } catch(_) { return ''; }
        }).join('');
        var $items = $(html); $holder.append($items);
        // Always reflect the VIEWER's quick-action state (not the profile owner's).
        // If viewer not logged in, default to all "add" (off) icons.
        try {
          var viewerId = (window.SITE_PREFS && SITE_PREFS.userId) || null;
          var idsMovie = items.filter(function(x){return x.type==='movie';}).map(function(x){return x.tmd_id;});
          var idsShow  = items.filter(function(x){return x.type==='show';}).map(function(x){return x.tmd_id;});
          // Hide both variants before applying
          idsMovie.forEach(function(id){ $('#add_watched_movie_'+id+',#remove_watched_movie_'+id+',#add_favourited_movie_'+id+',#remove_favourited_movie_'+id+',#add_saved_movie_'+id+',#remove_saved_movie_'+id).hide(); });
          idsShow.forEach(function(id){ $('#add_watched_show_'+id+',#remove_watched_show_'+id+',#add_favourited_show_'+id+',#remove_favourited_show_'+id+',#add_saved_show_'+id+',#remove_saved_show_'+id).hide(); });
          if (viewerId && window.StatusStore){
            if (idsMovie.length){ StatusStore.request('movie', idsMovie).then(function(list){ (list||[]).forEach(function(st, idx){ var id=idsMovie[idx]; if(!id) return; (st&&st.w===true?$('#remove_watched_movie_'+id):$('#add_watched_movie_'+id)).show(); (st&&st.f===true?$('#remove_favourited_movie_'+id):$('#add_favourited_movie_'+id)).show(); (st&&st.s===true?$('#remove_saved_movie_'+id):$('#add_saved_movie_'+id)).show(); }); }); }
            if (idsShow.length){ StatusStore.request('show', idsShow).then(function(list){ (list||[]).forEach(function(st, idx){ var id=idsShow[idx]; if(!id) return; (st&&st.w===true?$('#remove_watched_show_'+id):$('#add_watched_show_'+id)).show(); (st&&st.f===true?$('#remove_favourited_show_'+id):$('#add_favourited_show_'+id)).show(); (st&&st.s===true?$('#remove_saved_show_'+id):$('#add_saved_show_'+id)).show(); }); }); }
          } else {
            // Not logged in; always show "add" state (off)
            idsMovie.forEach(function(id){ $('#add_watched_movie_'+id+',#add_favourited_movie_'+id+',#add_saved_movie_'+id).show(); });
            idsShow.forEach(function(id){ $('#add_watched_show_'+id+',#add_favourited_show_'+id+',#add_saved_show_'+id).show(); });
          }
        } catch(_){}
        // Poster hydrate from client cache/queue
        try {
          var idsMovie = items.filter(function(x){return x.type==='movie';}).map(function(x){return x.tmd_id;});
          var idsShow  = items.filter(function(x){return x.type==='show';}).map(function(x){return x.tmd_id;});
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
  }
})();
