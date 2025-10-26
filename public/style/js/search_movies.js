// NOTE: How API requests happen from this file
// - The InfiniteScroll plugin is configured with a `path()` function that
//   generates URLs like:
//     /api/v1/movies/search/<term>/<pageIndex>
//     /api/v1/movies/search_genre/<genre>/<pageIndex>
// - Calling `$container.infiniteScroll('loadNextPage')` performs the HTTP GET
//   to that URL. When the response arrives, the plugin triggers the
//   `load.infiniteScroll` event, which we handle to parse the JSON and append
//   rendered items into `#movies_holder`.

(function () {
    // Run after DOM is ready so containers exist
    window.addEventListener('DOMContentLoaded', function () {
        var urlParams = parseQueryString(location.search);

        // Intercept Enter key (form submit) to avoid page reload
        var $input = $('#search_input');
        if ($input && $input.length) {
            $input.closest('form').on('submit', function (e) {
                e.preventDefault();
                searchMovies();
            });
        }

        if (urlParams.genre != null) {
            var g = urlParams.genre;
            try { g = decodeURIComponent(String(g).replace(/\+/g, ' ')); } catch (e) { /* noop */ }
            searchMovies(g);
            console.log("Searching by genre: " + urlParams.genre);
            return;
        }

        // Support landing on /movies?search_input=iron+man
        if (urlParams.search_input != null) {
            try {
                var term = decodeURIComponent(String(urlParams.search_input).replace(/\+/g, ' '));
                if ($input && $input.length) $input.val(term);
            } catch (e) { /* ignore */ }
            searchMovies();
        }
    });
})();

function searchMovies(genre) {
    var $holder = $('#movies_holder');
    // If a previous InfiniteScroll instance exists, destroy it and unbind events
    try { $holder.infiniteScroll('destroy'); } catch (e) { /* no-op */ }
    $holder.off('load.infiniteScroll');
    $holder.off('append.infiniteScroll');
    $holder.off('request.infiniteScroll');
    $holder.off('last.infiniteScroll');

    $holder.empty();
    $('#view_more').hide();

    var searchParam;
    var link;

    console.log("searchParam before if: " + searchParam);

    if (genre != null) {
        console.log("Searching by genre: " + genre);
        try { searchParam = decodeURIComponent(String(genre)); } catch (e) { searchParam = genre; }
        link = `/api/v1/movies/search_genre/`;
    } else {
        console.log("Searching by text input");
        searchParam = ($('#search_input').val() || '').trim();
        link = `/api/v1/movies/search/`;
    }

    // If no query and no genre, do nothing to avoid 404s
    if (!genre && (!searchParam || searchParam.length === 0)) {
        // Optionally focus the input for UX
        var $input = $('#search_input');
        if ($input && $input.length) $input.focus();
        return;
    }

    var $container;
    var seenIds = new Set();
    var autoButtonTimer = null;
    var consecutiveEmptyPages = 0;
    var autoLoadCount = 0;
    try {
        $container = $holder.infiniteScroll({
            path: function () {
                // Avoid double slashes when no searchParam
                var base = link;
                if (searchParam) {
                    base += encodeURIComponent(searchParam) + '/';
                }
                var qs = '';
                try {
                  if (window.SITE_PREFS && SITE_PREFS.hideWatchedInSearch && window.__uid && __uid()){
                    qs = '?profile_id=' + encodeURIComponent(__uid()) + '&hide_watched=1';
                  }
                } catch(_){}
                return base + this.pageIndex + qs;
            },
            responseType: 'text',
            loadOnScroll: true,
            prefill: false,
            scrollThreshold: 400,
            status: '.page-load-status',
            history: false // keep URL stable; we manage query via input/genre
        });
    } catch (error) {
        console.log(error);
        return;
    }

    // Show status UI; hide the manual button since scrolling is enabled
    $('#view_more').show();
    var $viewMoreButton = $('.view-more-button');
    $viewMoreButton.hide();
    $viewMoreButton.off('click').on('click', function(){
        $container.infiniteScroll('loadNextPage');
    });

    $container.on('request.infiniteScroll', function(){
        // hide button while a request is in-flight
        clearTimeout(autoButtonTimer);
        $viewMoreButton.hide();
    });

    $container.on('load.infiniteScroll', function (event, response) {
        var data = JSON.parse(response);
        var results = (data.results || []).map(function (m) {
            if (!m.poster_path && m.backdrop_path) {
                // Fallback so pagination still feels responsive
                m.poster_path = m.backdrop_path;
            }
            return m;
        });
        // De-duplicate by TMDB id across pages and DOM
        var items = [];
        var holderEl = $holder && $holder[0];
        (results||[]).forEach(function(m){
            var id = (m && (m.id!=null)) ? String(m.id) : '';
            if(!id) return;
            if (seenIds.has(id)) return;
            if (holderEl && holderEl.querySelector('[data-tmd-id="'+id+'"]')) return;
            var html = getItemHTML(m);
            if (html) { seenIds.add(id); items.push(html); }
        });
        var itemsHTML = items.join('');
        var $items = $(itemsHTML);
        $container.infiniteScroll('appendItems', $items);
        try {
          if (window.StatusStore){
            var idsToPrefetch = (results||[]).map(function(m){ return m && m.id; }).filter(Boolean);
            StatusStore.request('movie', idsToPrefetch).then(function(list){
              if (!(window.SITE_PREFS && SITE_PREFS.hideWatchedInSearch)) return;
              try {
                var holder = document.getElementById('movies_holder');
                (results||[]).forEach(function(m, idx){
                  var st = list[idx] || {}; if (!st || !st.w) return;
                  var el = holder && holder.querySelector('[data-tmd-id="'+ String(m.id) +'"]');
                  if (el) el.style.display = 'none';
                });
              } catch(_){}
            });
          }
        } catch(_){}

        // If nothing appended and there are more pages, auto-skip to next
        var appendedCount = $items.length;
        var totalPages = (data.total_pages || 0);
        var currentPage = (data.page || 0);
        if (appendedCount === 0 && totalPages && currentPage && currentPage < totalPages) {
            consecutiveEmptyPages++;
            if (consecutiveEmptyPages <= 2) {
                // try to fetch next page to avoid dead-ends
                $container.infiniteScroll('loadNextPage');
                return;
            }
        } else {
            consecutiveEmptyPages = 0;
        }

        // Schedule showing the button if no auto-load happens shortly
        clearTimeout(autoButtonTimer);
        autoButtonTimer = setTimeout(function(){
            $viewMoreButton.show();
        }, 900);
    });

    // When items are appended, decide if we should pause auto-loading
    $container.on('append.infiniteScroll', function(){
        autoLoadCount++;
        // After several auto loads, pause auto-loading and show button
        if (autoLoadCount >= 4) {
            $container.infiniteScroll('option', { loadOnScroll: false });
            $viewMoreButton.show();
        }
    });

    $container.on('last.infiniteScroll', function(){
        clearTimeout(autoButtonTimer);
        $viewMoreButton.hide();
    });

    // load initial page
    $container.infiniteScroll('loadNextPage');

    // Re-enable auto scroll on manual button click and reset counter
    $viewMoreButton.on('click', function(){
        autoLoadCount = 0;
        $container.infiniteScroll('option', { loadOnScroll: true });
        $viewMoreButton.hide();
    });

    //------------------//

    var itemTemplateSrc = $('#movie-template').html();
    
    function getItemHTML(movie) {
        // ensure slug available for links
        try { movie.slug = slugify(movie.title || movie.name || ''); } catch(_) { movie.slug = ''; }
        return microTemplate(itemTemplateSrc, movie);
    }

    // micro templating, sort-of
    function microTemplate(src, data) {
        if (data.poster_path == null || data.poster_path == "")
            return null;
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

    function slugify(s){
        return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80);
    }
}

function parseQueryString(url) {
    var urlParams = {};
    url.replace(
        new RegExp("([^?=&]+)(=([^&]*))?", "g"),
        function ($0, $1, $2, $3) {
            urlParams[$1] = $3;
        }
    );
    return urlParams;
}
