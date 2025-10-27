function profileWatchedMovies(user_id) {
    $('#view_more').show();

    var link = `/api/v1/user-movies/watched/${user_id}/`;
    var host = location.origin;
    var posterlink = `/api/v1/movies/get_poster/`;
    var $holder = $('#movies_holder');
    var seenIds = new Set();
    var autoButtonTimer = null;
    var autoLoadCount = 0;

    var $container = $holder.infiniteScroll({
        path: function () { return link + this.pageIndex; },
        responseType: 'text',
        loadOnScroll: true,
        prefill: false,
        scrollThreshold: 400,
        status: '.page-load-status',
        history: false,
    });

    // No manual button on watched page; infinite scroll only

    $container.on('load.infiniteScroll', function (event, response) {
        var data = {};
        try { data = JSON.parse(response || '{}'); } catch(_) { data = {}; }
        var results = Array.isArray(data.results) ? data.results.slice() : [];
        // De-duplicate by TMDB id across pages and DOM
        var items = [];
        var holderEl = $holder && $holder[0];
        (results||[]).forEach(function(m){
            var id = (m && (m.tmd_id!=null)) ? String(m.tmd_id) : '';
            if(!id) return;
            if (seenIds.has(id)) return;
            if (holderEl && holderEl.querySelector('[data-tmd-id="'+id+'"]')) return;
            var html = getItemHTML(m);
            if (html) { seenIds.add(id); items.push(html); }
        });
        var itemsHTML = items.join('');
        var $items = $(itemsHTML);
        $container.infiniteScroll('appendItems', $items);
        // Bulk status fetch for quick actions (watched/favourited/saved)
        try {
            var uid = (window.SITE_PREFS && SITE_PREFS.userId) || null;
            if (uid && window.StatusStore && results.length) {
                var ids = results.map(function(m){ return m.tmd_id; }).filter(Boolean);
                ids.forEach(function(id){
                    $("#add_watched_movie_"+id+", #remove_watched_movie_"+id+", #add_favourited_movie_"+id+", #remove_favourited_movie_"+id+", #add_saved_movie_"+id+", #remove_saved_movie_"+id).hide();
                });
                StatusStore.request('movie', ids).then(function(list){
                    (list || []).forEach(function(st, idx){
                        var id = ids[idx]; if (!id) return;
                        if (st && st.w===true) { $("#remove_watched_movie_"+id).show(); } else { $("#add_watched_movie_"+id).show(); }
                        if (st && st.f===true) { $("#remove_favourited_movie_"+id).show(); } else { $("#add_favourited_movie_"+id).show(); }
                        if (st && st.s===true) { $("#remove_saved_movie_"+id).show(); } else { $("#add_saved_movie_"+id).show(); }
                    });
                }).catch(function(){});
                // Queue poster fetches with low concurrency so pagination isn't blocked
                try {
                    ids.forEach(function(id){
                        // Serve from client cache when possible
                        try {
                            if (window.PosterCache){
                                var cached = PosterCache.get('movie', id);
                                if (cached){
                                    var tmdImageLink = "https://image.tmdb.org/t/p/w342/";
                                    $("[name='movie_id_"+id+"']").attr('src', tmdImageLink + cached);
                                    return; // skip queue
                                }
                            }
                        } catch(_){ }
                        PosterQueue.enqueue(id);
                    });
                } catch(_){}
            }
        } catch(_){}

        // Keep autoloading; no manual View More button
    });

    $container.on('last.infiniteScroll', function(){ /* nothing to toggle */ });

    // load initial page
    $container.infiniteScroll('loadNextPage');

    //------------------//
    var itemTemplateSrc = $('#movie-template').html();
    function getItemHTML(movie) {
        if (!movie) return null;
        try { movie.slug = slugify(movie.title || movie.name || movie.movie_title || ''); } catch(_) { movie.slug = ''; }
        return microTemplate(itemTemplateSrc, movie);
    }
    function microTemplate(src, data) {
        return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function (match, key) {
            var value = data; key.split('.').forEach(function (part) { value = value[part]; }); return value;
        });
    }
    // Concurrency-limited poster fetch queue to avoid blocking next-page requests
    var PosterQueue = (function(){
        var q = [];
        var running = 0;
        var MAX = 2; // keep low to free connections for pagination
        function pump(){
            if (running >= MAX) return;
            var id = q.shift();
            if (!id) return;
            running += 1;
            var url = host + posterlink + id;
            var tmdImageLink = "https://image.tmdb.org/t/p/w342/";
            fetch(url)
              .then(function(r){ return r.ok ? r.json() : {}; })
              .then(function(data){
                if (data && data.poster_path) {
                  try { if (window.PosterCache) PosterCache.put('movie', id, data.poster_path); } catch(_){ }
                  $("[name='movie_id_"+id+"']").attr('src', tmdImageLink + data.poster_path);
                }
              })
              .catch(function(){})
              .finally(function(){ running -= 1; if (q.length) { setTimeout(pump, 0); } });
        }
        return {
            enqueue: function(id){ if (!id) return; q.push(id); setTimeout(pump, 0); }
        };
    })();
}

function slugify(s){
    return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80);
}

// Render saved list into a custom holder (supports element scrolling)
function profileSavedMoviesInto(holderSelector, user_id, opts){
    opts = opts || {}; var elementScroll = !!opts.elementScroll;
    var link = `/api/v1/user-movies/saved/${user_id}/`;
    var host = location.origin; var posterlink = `/api/v1/movies/get_poster/`;
    var $holder = $(holderSelector); var seenIds = new Set();
    var $container = $holder.infiniteScroll({ path:function(){ return link + this.pageIndex; }, responseType:'text', loadOnScroll:true, prefill:true, scrollThreshold:300, history:false, elementScroll: elementScroll });
    function maybePrefill(){ if(!elementScroll) return; try{ var el=$holder&&$holder[0]; if(!el) return; if(el.scrollHeight <= el.clientHeight + 4){ if(($holder.data('infiniteScroll')||{}).pageIndex < 50){ $container.infiniteScroll('loadNextPage'); } } } catch(_){} }
    $container.on('load.infiniteScroll', function (event, response) {
        var data = {}; try { data = JSON.parse(response||'{}'); } catch(_) { data = {}; }
        var results = Array.isArray(data.results) ? data.results.slice() : [];
        var items = []; var holderEl = $holder && $holder[0];
        (results||[]).forEach(function(m){ var id=(m&&m.tmd_id!=null)?String(m.tmd_id):''; if(!id) return; if(seenIds.has(id)) return; if(holderEl && holderEl.querySelector('[data-tmd-id="'+id+'"]')) return; items.push(getItemHTML(m)); seenIds.add(id); });
        var $items = $(items.join('')); $container.infiniteScroll('appendItems', $items);
        maybePrefill();
        try { var ids = results.map(function(m){ return m.tmd_id; }).filter(Boolean);
            ids.forEach(function(id){ $("#add_watched_movie_"+id+", #remove_watched_movie_"+id+", #add_favourited_movie_"+id+", #remove_favourited_movie_"+id+", #add_saved_movie_"+id+", #remove_saved_movie_"+id).hide(); });
            if (window.StatusStore){ StatusStore.request('movie', ids).then(function(list){ (list||[]).forEach(function(st, idx){ var id=ids[idx]; if(!id) return; if(st&&st.w===true) $("#remove_watched_movie_"+id).show(); else $("#add_watched_movie_"+id).show(); if(st&&st.f===true) $("#remove_favourited_movie_"+id).show(); else $("#add_favourited_movie_"+id).show(); if(st&&st.s===true) $("#remove_saved_movie_"+id).show(); else $("#add_saved_movie_"+id).show(); }); }); }
            ids.forEach(function(id){ try { var cached = window.PosterCache && PosterCache.get('movie', id); if(cached){ $("[name='movie_id_"+id+"']").attr('src','https://image.tmdb.org/t/p/w342/'+cached); return; } } catch(_){}
                PosterQueue.enqueue(id);
            });
        } catch(_){}
    });
    $container.infiniteScroll('loadNextPage'); setTimeout(maybePrefill, 400);
    var itemTemplateSrc = $('#movie-template').html();
    function getItemHTML(movie){ try { movie.slug = slugify(movie.movie_title || movie.title || movie.name || ''); } catch(_) { movie.slug = ''; } return microTemplate(itemTemplateSrc, movie); }
    function microTemplate(src, data){ return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function (m,k){ var v=data; k.split('.').forEach(function(p){ v=v[p]; }); return v; }); }
    var PosterQueue=(function(){ var q=[],running=0,MAX=2; function pump(){ if(running>=MAX) return; var id=q.shift(); if(!id) return; running++; var url=host+posterlink+id; fetch(url).then(function(r){return r.ok?r.json():{};}).then(function(d){ if(d&&d.poster_path){ try{ PosterCache&&PosterCache.put('movie',id,d.poster_path);}catch(_){} $("[name='movie_id_"+id+"']").attr('src','https://image.tmdb.org/t/p/w342/'+d.poster_path); } }).finally(function(){ running--; if(q.length) setTimeout(pump,0); }); } return { enqueue:function(id){ if(!id) return; q.push(id); setTimeout(pump,0); } }; })();
}
// Render favourites into a custom holder (supports element scrolling)
function profileFavouriteMoviesInto(holderSelector, user_id, opts){
    opts = opts || {}; var elementScroll = !!opts.elementScroll;
    var link = `/api/v1/user-movies/favourited/${user_id}/`;
    var host = location.origin; var posterlink = `/api/v1/movies/get_poster/`;
    var $holder = $(holderSelector); var seenIds = new Set();
    var $container = $holder.infiniteScroll({ path:function(){ return link + this.pageIndex; }, responseType:'text', loadOnScroll:true, prefill:true, scrollThreshold: 300, history:false, elementScroll: elementScroll });
    function maybePrefill(){ if(!elementScroll) return; try{ var el=$holder&&$holder[0]; if(!el) return; if(el.scrollHeight <= el.clientHeight + 4){ if(($holder.data('infiniteScroll')||{}).pageIndex < 50){ $container.infiniteScroll('loadNextPage'); } } } catch(_){} }
    $container.on('load.infiniteScroll', function (event, response) {
        var data = {}; try { data = JSON.parse(response||'{}'); } catch(_) { data = {}; }
        var results = Array.isArray(data.results) ? data.results.slice() : [];
        var items = []; var holderEl = $holder && $holder[0];
        (results||[]).forEach(function(m){ var id=(m&&m.tmd_id!=null)?String(m.tmd_id):''; if(!id) return; if(seenIds.has(id)) return; if(holderEl && holderEl.querySelector('[data-tmd-id="'+id+'"]')) return; items.push(getItemHTML(m)); seenIds.add(id); });
        var $items = $(items.join('')); $container.infiniteScroll('appendItems', $items);
        maybePrefill();
        try { var ids = results.map(function(m){ return m.tmd_id; }).filter(Boolean);
            ids.forEach(function(id){ $("#add_watched_movie_"+id+", #remove_watched_movie_"+id+", #add_favourited_movie_"+id+", #remove_favourited_movie_"+id+", #add_saved_movie_"+id+", #remove_saved_movie_"+id).hide(); });
            if (window.StatusStore){ StatusStore.request('movie', ids).then(function(list){ (list||[]).forEach(function(st, idx){ var id=ids[idx]; if(!id) return; if(st&&st.w===true) $("#remove_watched_movie_"+id).show(); else $("#add_watched_movie_"+id).show(); if(st&&st.f===true) $("#remove_favourited_movie_"+id).show(); else $("#add_favourited_movie_"+id).show(); if(st&&st.s===true) $("#remove_saved_movie_"+id).show(); else $("#add_saved_movie_"+id).show(); }); }); }
            ids.forEach(function(id){ try { var cached = window.PosterCache && PosterCache.get('movie', id); if(cached){ $("[name='movie_id_"+id+"']").attr('src','https://image.tmdb.org/t/p/w342/'+cached); return; } } catch(_){}
                PosterQueue.enqueue(id);
            });
        } catch(_){}
    });
    $container.infiniteScroll('loadNextPage'); setTimeout(maybePrefill, 400);
    var itemTemplateSrc = $('#movie-template').html();
    function getItemHTML(movie){ try { movie.slug = slugify(movie.movie_title || movie.title || movie.name || ''); } catch(_) { movie.slug=''; } return microTemplate(itemTemplateSrc, movie); }
    function microTemplate(src, data){ return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function (m,k){ var v=data; k.split('.').forEach(function(p){ v=v[p]; }); return v; }); }
    var PosterQueue=(function(){ var q=[],running=0,MAX=2; function pump(){ if(running>=MAX) return; var id=q.shift(); if(!id) return; running++; var url=host+posterlink+id; fetch(url).then(function(r){return r.ok?r.json():{};}).then(function(d){ if(d&&d.poster_path){ try{ PosterCache&&PosterCache.put('movie',id,d.poster_path);}catch(_){} $("[name='movie_id_"+id+"']").attr('src','https://image.tmdb.org/t/p/w342/'+d.poster_path); } }).finally(function(){ running--; if(q.length) setTimeout(pump,0); }); } return { enqueue:function(id){ if(!id) return; q.push(id); setTimeout(pump,0); } }; })();
}

function profileFavouriteMovies(user_id){
    $('#view_more').show();

    var link = `/api/v1/user-movies/favourited/${user_id}/`;
    var host = location.origin;
    var posterlink = `/api/v1/movies/get_poster/`;

    var $holder = $('#movies_holder');
    var seenIds = new Set();
    var $container = $holder.infiniteScroll({
        path: function(){ return link + this.pageIndex; },
        responseType: 'text', loadOnScroll: true, prefill: false, scrollThreshold: 400, status: '.page-load-status', history: false
    });


    $container.on('load.infiniteScroll', function (event, response) {
        var data = {};
        try { data = JSON.parse(response||'{}'); } catch(_) { data = {}; }
        var results = Array.isArray(data.results) ? data.results.slice() : [];
        var items = []; var holderEl = $holder && $holder[0];
        (results||[]).forEach(function(m){ var id=(m&&m.tmd_id!=null)?String(m.tmd_id):''; if(!id) return; if(seenIds.has(id)) return; if(holderEl && holderEl.querySelector('[data-tmd-id="'+id+'"]')) return; items.push(getItemHTML(m)); seenIds.add(id); });
        var $items = $(items.join('')); $container.infiniteScroll('appendItems', $items);
        try {
            var ids = results.map(function(m){ return m.tmd_id; }).filter(Boolean);
            ids.forEach(function(id){ $("#add_watched_movie_"+id+", #remove_watched_movie_"+id+", #add_favourited_movie_"+id+", #remove_favourited_movie_"+id+", #add_saved_movie_"+id+", #remove_saved_movie_"+id).hide(); });
            if (window.StatusStore) {
                StatusStore.request('movie', ids).then(function(list){
                    (list||[]).forEach(function(st, idx){
                        var id = ids[idx]; if(!id) return;
                        if (st && st.w===true) $("#remove_watched_movie_"+id).show(); else $("#add_watched_movie_"+id).show();
                        if (st && st.f===true) $("#remove_favourited_movie_"+id).show(); else $("#add_favourited_movie_"+id).show();
                        if (st && st.s===true) $("#remove_saved_movie_"+id).show(); else $("#add_saved_movie_"+id).show();
                    });
                });
            }
            // Posters: serve from client cache or queue fetches
            ids.forEach(function(id){ try { var cached = window.PosterCache && PosterCache.get('movie', id); if (cached) { $("[name='movie_id_"+id+"']").attr('src', 'https://image.tmdb.org/t/p/w342/'+cached); return; } } catch(_) {}
                PosterQueue.enqueue(id);
            });
        } catch(_){}
    });

    $container.infiniteScroll('loadNextPage');

    //------------------//

    var itemTemplateSrc = $('#movie-template').html();
    
    function getItemHTML(movie) { try { movie.slug = slugify(movie.movie_title || movie.title || movie.name || ''); } catch(_) { movie.slug=''; } return microTemplate(itemTemplateSrc, movie); }

    // micro templating, sort-of
    function microTemplate(src, data) {
        // replace {{tags}} in source
        return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function (match, key) {
            // walk through objects to get value
            var value = data;
            key.split('.').forEach(function (part) {
                value = value[part];
            });

            return value;
        });
    }

    //----------------------//
    //Get poster links


    // Concurrency-limited poster queue
    var PosterQueue=(function(){ var q=[],running=0,MAX=2; function pump(){ if(running>=MAX) return; var id=q.shift(); if(!id) return; running++; var url=host+posterlink+id; fetch(url).then(function(r){return r.ok?r.json():{};}).then(function(d){ if(d&&d.poster_path){ try{ if(window.PosterCache) PosterCache.put('movie',id,d.poster_path);}catch(_){} $("[name='movie_id_"+id+"']").attr('src','https://image.tmdb.org/t/p/w342/'+d.poster_path); } }).finally(function(){ running--; if(q.length) setTimeout(pump,0); }); } return { enqueue:function(id){ if(!id) return; q.push(id); setTimeout(pump,0); } }; })();
   
}

function profileSavedMovies(user_id){
    $('#view_more').show();

    var link = `/api/v1/user-movies/saved/${user_id}/`;
    var host = location.origin;
    var posterlink = `/api/v1/movies/get_poster/`;

    var $holder = $('#movies_holder');
    var seenIds = new Set();
    var $container = $holder.infiniteScroll({ path: function(){ return link + this.pageIndex; }, responseType:'text', loadOnScroll:true, prefill:false, scrollThreshold:400, status:'.page-load-status', history:false });


    $container.on('load.infiniteScroll', function (event, response) {
        var data = {};
        try { data = JSON.parse(response||'{}'); } catch(_) { data = {}; }
        var results = Array.isArray(data.results) ? data.results.slice() : [];
        var items = []; var holderEl = $holder && $holder[0];
        (results||[]).forEach(function(m){ var id=(m&&m.tmd_id!=null)?String(m.tmd_id):''; if(!id) return; if(seenIds.has(id)) return; if(holderEl && holderEl.querySelector('[data-tmd-id="'+id+'"]')) return; items.push(getItemHTML(m)); seenIds.add(id); });
        var $items = $(items.join('')); $container.infiniteScroll('appendItems', $items);
        try {
            var ids = results.map(function(m){ return m.tmd_id; }).filter(Boolean);
            ids.forEach(function(id){ $("#add_watched_movie_"+id+", #remove_watched_movie_"+id+", #add_favourited_movie_"+id+", #remove_favourited_movie_"+id+", #add_saved_movie_"+id+", #remove_saved_movie_"+id).hide(); });
            if (window.StatusStore) {
                StatusStore.request('movie', ids).then(function(list){ (list||[]).forEach(function(st, idx){ var id=ids[idx]; if(!id) return; if (st && st.w===true) $("#remove_watched_movie_"+id).show(); else $("#add_watched_movie_"+id).show(); if (st && st.f===true) $("#remove_favourited_movie_"+id).show(); else $("#add_favourited_movie_"+id).show(); if (st && st.s===true) $("#remove_saved_movie_"+id).show(); else $("#add_saved_movie_"+id).show(); }); });
            }
            ids.forEach(function(id){ try { var cached = window.PosterCache && PosterCache.get('movie', id); if (cached) { $("[name='movie_id_"+id+"']").attr('src', 'https://image.tmdb.org/t/p/w342/'+cached); return; } } catch(_) {}
                PosterQueue.enqueue(id);
            });
        } catch(_){}
    });

    $container.infiniteScroll('loadNextPage');

    //------------------//

    var itemTemplateSrc = $('#movie-template').html();
    
    function getItemHTML(movie){ try { movie.slug = slugify(movie.movie_title || movie.title || movie.name || ''); } catch(_) { movie.slug = ''; } return microTemplate(itemTemplateSrc, movie); }

    // micro templating, sort-of
    function microTemplate(src, data) {
        // replace {{tags}} in source
        return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function (match, key) {
            // walk through objects to get value
            var value = data;
            key.split('.').forEach(function (part) {
                value = value[part];
            });

            return value;
        });
    }

    //----------------------//
    //Get poster links


    function getPoster(movie_id) {
        let url = host + posterlink + movie_id;
        let tmdImageLink= "https://image.tmdb.org/t/p/w500/";

        fetch(url)
        .then(response => response.json())
        .then(data => {
            $(`[name='movie_id_${movie_id}']`).attr("src", tmdImageLink+data.poster_path);
        })
        .catch(error => {
            console.log(error)
        })

    }
   
}

function profileMoviesLatest(user_id) {
    $('#view_more').show()

    var link = `/api/v1/user-movies/latest/${user_id}`;
    var host = location.origin;
    var posterlink = `/api/v1/movies/get_poster/`;

    var $container = $('#movies_holder').infiniteScroll({
        path: function () {
            return link;
        },
        // load response as flat text
        responseType: 'text',
        loadOnScroll: false,
        status: '.page-load-status',
        history: true,
    });

    var $viewMoreButton = $('.view-more-button');
    $viewMoreButton.on('click', function () {
        // load next page
        $container.infiniteScroll('loadNextPage');
        // enable loading on scroll
        $container.infiniteScroll('option', {
            loadOnScroll: true,
        });
        // hide button
        $viewMoreButton.hide();
    });


    $container.on('load.infiniteScroll', function (event, response) {
        // parse response into JSON data
        var data = JSON.parse(response);
        // compile data into HTML
        var itemsHTML = data.results.map(getItemHTML).join('');
        // convert HTML string into elements
        var $items = $(itemsHTML);
        // append item elements
        $container.infiniteScroll('appendItems', $items);
    });

    // load initial page
    $container.infiniteScroll('loadNextPage');

    //------------------//

    var itemTemplateSrc = $('#movie-template').html();
    
    function getItemHTML(movie) {
        getPoster(movie.tmd_id)
        try { movie.slug = slugify(movie.movie_title || movie.title || movie.name || ''); } catch(_) { movie.slug = ''; }
        return microTemplate(itemTemplateSrc, movie);
    }

    // micro templating, sort-of
    function microTemplate(src, data) {
        // replace {{tags}} in source
        return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function (match, key) {
            // walk through objects to get value
            var value = data;
            key.split('.').forEach(function (part) {
                value = value[part];
            });

            return value;
        });
    }

    //----------------------//
    //Get poster links


    // Concurrency-limited poster queue
    var PosterQueue=(function(){ var q=[],running=0,MAX=2; function pump(){ if(running>=MAX) return; var id=q.shift(); if(!id) return; running++; var url=host+posterlink+id; fetch(url).then(function(r){return r.ok?r.json():{};}).then(function(d){ if(d&&d.poster_path){ try{ if(window.PosterCache) PosterCache.put('movie',id,d.poster_path);}catch(_){} $("[name='movie_id_"+id+"']").attr('src','https://image.tmdb.org/t/p/w342/'+d.poster_path); } }).finally(function(){ running--; if(q.length) setTimeout(pump,0); }); } return { enqueue:function(id){ if(!id) return; q.push(id); setTimeout(pump,0); } }; })();

}
