(function(){
    function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80); }

    function initList($holder, link, templateId){
        try { $holder.infiniteScroll('destroy'); } catch (e) {}
        $holder.off('load.infiniteScroll'); $holder.off('append.infiniteScroll');
        $('#view_more').hide();
        var $container = $holder.infiniteScroll({
            path: function(){ return link + this.pageIndex; },
            responseType: 'text', loadOnScroll: false, status: '.page-load-status', history: true
        });
        var $viewMoreButton = $('.view-more-button');
        $viewMoreButton.on('click', function(){ $container.infiniteScroll('loadNextPage'); $container.infiniteScroll('option', { loadOnScroll: true }); $viewMoreButton.hide(); });
        $container.on('load.infiniteScroll', function(event, response){
            var data = JSON.parse(response);
            var items = (data.results||[]);
            var itemsHTML = items.map(function(show){ show.slug = slugify(show.show_title||show.name||''); return microTemplate($('#'+templateId).html(), show); }).join('');
            var $items = $(itemsHTML); $container.infiniteScroll('appendItems', $items);
            // fetch posters lazily
            try {
                items.forEach(function(s){ fetch('/api/v1/shows/get_poster/'+s.tmd_id).then(function(r){ return r.json(); }).then(function(d){ if(d && d.poster_path){ $("[name='show_id_"+s.tmd_id+"']").attr('src', 'https://image.tmdb.org/t/p/w500/'+d.poster_path); } }).catch(function(){}); });
            } catch(e){}
        });
        $container.infiniteScroll('loadNextPage');
        function microTemplate(src, data){ return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function(match, key){ var value=data; key.split('.').forEach(function(part){ value=value[part]; }); return value; }); }
    }

    window.profileWatchedShows = function(user_id){
        $('#view_more').show();
        initList($('#movies_holder'), `/api/v1/profile/shows/watched/${user_id}/`, 'show-template');
    }
})();
