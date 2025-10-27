(function(){
    function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80); }

    function initList($holder, link, templateId, opts){
        opts = opts || {}; var sort = opts.sort || ''; var buttonless = !!opts.buttonless;
        // Destroy safely if previously initialized
        try { if ($holder.data('infiniteScroll')) { $holder.infiniteScroll('destroy'); } } catch (e) {}
        $holder.off('load.infiniteScroll'); $holder.off('append.infiniteScroll');
        // Ensure the manual "View more" control is visible
        $('#view_more').show();
        var $container = $holder.infiniteScroll({
            path: function(){ return link + this.pageIndex + (sort ? ('?sort='+encodeURIComponent(sort)) : ''); },
            responseType: 'text', loadOnScroll: true, prefill: !!opts.elementScroll, scrollThreshold: 300, history: false, elementScroll: !!opts.elementScroll
        });
        var $viewMoreButton = $('.view-more-button');
        if (!buttonless) {
            $viewMoreButton.hide();
            $viewMoreButton.off('click.profileShows');
            $viewMoreButton.on('click.profileShows', function(){ $container.infiniteScroll('loadNextPage'); });
            $container.on('request.infiniteScroll', function(){ $viewMoreButton.hide(); });
        } else {
            // ensure any existing button is hidden
            try { $viewMoreButton.hide(); } catch(_){ }
        }
        var autoLoadCount = 0, autoButtonTimer = null;
        function maybePrefill() {
            if (!opts.elementScroll) return;
            try {
                var el = $holder && $holder[0];
                if (!el) return;
                // If content does not overflow yet, request another page
                if (el.scrollHeight <= el.clientHeight + 4) {
                    // guard to avoid tight loops
                    if (autoLoadCount < 12) {
                        $container.infiniteScroll('loadNextPage');
                    }
                }
            } catch(_){}
        }
        var host = location.origin; var posterlink = '/api/v1/shows/get_poster/';
        var seen = new Set();
        $container.on('load.infiniteScroll', function(event, response){
            var data = {};
            try { data = JSON.parse(response||'{}'); } catch(_) { data = {}; }
            var items = Array.isArray(data.results) ? data.results.slice() : [];
            // De-duplicate by TMDB id in case of double loads
            items = items.filter(function(s){ if(!s || !s.tmd_id) return false; var k=String(s.tmd_id); if(seen.has(k)) return false; seen.add(k); return true; });
            var tpl = $('#'+templateId).html();
            var itemsHTML = items.map(function(show){ show.slug = slugify(show.show_title||show.name||''); return microTemplate(tpl, show); }).join('');
            var $items = $(itemsHTML); $container.infiniteScroll('appendItems', $items);
            // Bulk status for quick actions
            try {
                var uid = (window.SITE_PREFS && SITE_PREFS.userId) || null;
                if (uid && window.StatusStore && items.length){
                    var ids = items.map(function(s){ return s.tmd_id; }).filter(Boolean);
                    ids.forEach(function(id){ $("#add_watched_show_"+id+", #remove_watched_show_"+id+", #add_favourited_show_"+id+", #remove_favourited_show_"+id+", #add_saved_show_"+id+", #remove_saved_show_"+id).hide(); });
                    StatusStore.request('show', ids).then(function(list){
                        (list||[]).forEach(function(st, idx){
                            var id = ids[idx]; if (!id) return;
                            if (st && st.w===true) { $("#remove_watched_show_"+id).show(); } else { $("#add_watched_show_"+id).show(); }
                            if (st && st.f===true) { $("#remove_favourited_show_"+id).show(); } else { $("#add_favourited_show_"+id).show(); }
                            if (st && st.s===true) { $("#remove_saved_show_"+id).show(); } else { $("#add_saved_show_"+id).show(); }
                        });
                    }).catch(function(){});
                    // Posters: serve from client cache or enqueue low-concurrency fetches
                    try {
                        ids.forEach(function(id){
                            try {
                                if (window.PosterCache){
                                    var cached = PosterCache.get('show', id);
                                    if (cached){
                                        var tmdImageLink = 'https://image.tmdb.org/t/p/w342/';
                                        $("[name='show_id_"+id+"']").attr('src', tmdImageLink + cached);
                                        return; // skip queue
                                    }
                                }
                            } catch(_){}
                            PosterQueue.enqueue(id);
                        });
                    } catch(_){}
                }
            } catch(_){}
            // Watched pages: infinite scrolling only; others: show button after a few auto-loads
            autoLoadCount++;
            // Ensure element-scrolled containers fill enough to allow scrolling
            maybePrefill();
            if (!buttonless) {
                if (autoLoadCount >= 4) {
                    $container.infiniteScroll('option', { loadOnScroll: false });
                    $viewMoreButton.show();
                } else {
                    clearTimeout(autoButtonTimer);
                    autoButtonTimer = setTimeout(function(){ $viewMoreButton.show(); }, 900);
                }
            }
        });
        $container.on('last.infiniteScroll', function(){ clearTimeout(autoButtonTimer); if (!buttonless) $viewMoreButton.hide(); });
        // load first page
        $container.infiniteScroll('loadNextPage');
        // In case the first response is short, try pre-filling once more shortly after init
        setTimeout(maybePrefill, 400);
        function microTemplate(src, data){ return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function(match, key){ var value=data; key.split('.').forEach(function(part){ value=value[part]; }); return value; }); }

        // Concurrency-limited poster fetch queue
        var PosterQueue = (function(){
            var q = []; var running = 0; var MAX = 2;
            function pump(){
                if (running >= MAX) return;
                var id = q.shift(); if (!id) return; running += 1;
                var url = host + posterlink + id; var tmdImageLink = 'https://image.tmdb.org/t/p/w342/';
                fetch(url)
                  .then(function(r){ return r.ok ? r.json() : {}; })
                  .then(function(data){ if (data && data.poster_path){ try { if (window.PosterCache) PosterCache.put('show', id, data.poster_path); } catch(_){} $("[name='show_id_"+id+"']").attr('src', tmdImageLink + data.poster_path); } })
                  .catch(function(){})
                  .finally(function(){ running -= 1; if (q.length) setTimeout(pump, 0); });
            }
            return { enqueue: function(id){ if (!id) return; q.push(id); setTimeout(pump, 0); } };
        })();
    }

    window.profileWatchedShows = function(user_id, sort){
        $('#view_more').show();
        initList($('#movies_holder'), `/api/v1/user-shows/watched/${user_id}/`, 'show-template', { sort: sort, buttonless: true });
    }

    // Favourited shows
    window.profileFavouriteShows = function(user_id){
        $('#view_more').show();
        initList($('#movies_holder'), `/api/v1/user-shows/favourited/${user_id}/`, 'show-template', { buttonless: true });
    }

    // Saved (bookmarked) shows
    window.profileSavedShows = function(user_id){
        $('#view_more').show();
        initList($('#movies_holder'), `/api/v1/user-shows/saved/${user_id}/`, 'show-template', { buttonless: true });
    }

    // Into custom holder (for split boxes)
    window.profileFavouriteShowsInto = function(holderSelector, user_id, opts){
        opts = opts || {}; opts.buttonless = true; opts.elementScroll = !!opts.elementScroll;
        var $h = (holderSelector && holderSelector.jquery) ? holderSelector : $(holderSelector);
        initList($h, `/api/v1/user-shows/favourited/${user_id}/`, 'show-template', opts);
    }
    window.profileSavedShowsInto = function(holderSelector, user_id, opts){
        opts = opts || {}; opts.buttonless = true; opts.elementScroll = !!opts.elementScroll;
        var $h = (holderSelector && holderSelector.jquery) ? holderSelector : $(holderSelector);
        initList($h, `/api/v1/user-shows/saved/${user_id}/`, 'show-template', opts);
    }
})();
