(function(){
    function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80); }

    function initList($holder, link, templateId, opts){
        opts = opts || {}; var sort = opts.sort || '';
        // Destroy safely if previously initialized
        try { if ($holder.data('infiniteScroll')) { $holder.infiniteScroll('destroy'); } } catch (e) {}
        $holder.off('load.infiniteScroll'); $holder.off('append.infiniteScroll');
        // Ensure the manual "View more" control is visible
        $('#view_more').show();
        var $container = $holder.infiniteScroll({
            path: function(){ return link + this.pageIndex + (sort ? ('?sort='+encodeURIComponent(sort)) : ''); },
            responseType: 'text', loadOnScroll: false, status: '.page-load-status', history: false
        });
        var $viewMoreButton = $('.view-more-button');
        $viewMoreButton.off('click.profileShows');
        $viewMoreButton.on('click.profileShows', function(){
            $container.infiniteScroll('loadNextPage');
            $container.infiniteScroll('option', { loadOnScroll: true });
            $viewMoreButton.hide();
        });
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
            // fetch posters lazily
            try {
                items.forEach(function(s){ fetch('/api/v1/shows/get_poster/'+s.tmd_id).then(function(r){ return r.json(); }).then(function(d){ if(d && d.poster_path){ $("[name='show_id_"+s.tmd_id+"']").attr('src', 'https://image.tmdb.org/t/p/w500/'+d.poster_path); } }).catch(function(){}); });
            } catch(e){}
        });
        // load first page
        $container.infiniteScroll('loadNextPage');
        function microTemplate(src, data){ return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function(match, key){ var value=data; key.split('.').forEach(function(part){ value=value[part]; }); return value; }); }
    }

    window.profileWatchedShows = function(user_id, sort){
        $('#view_more').show();
        initList($('#movies_holder'), `/api/v1/user-shows/watched/${user_id}/`, 'show-template', { sort: sort });
    }

    // Favourited shows
    window.profileFavouriteShows = function(user_id){
        $('#view_more').show();
        initList($('#movies_holder'), `/api/v1/user-shows/favourited/${user_id}/`, 'show-template');
    }

    // Saved (bookmarked) shows
    window.profileSavedShows = function(user_id){
        $('#view_more').show();
        initList($('#movies_holder'), `/api/v1/user-shows/saved/${user_id}/`, 'show-template');
    }
})();
