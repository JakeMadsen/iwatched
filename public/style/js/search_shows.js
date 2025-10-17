(function () {
  // Run after DOM is ready so containers exist
  window.addEventListener('DOMContentLoaded', function () {
    var urlParams = parseQueryString(location.search);

    // Intercept Enter key (form submit) to avoid page reload
    var $input = $('#search_input');
    if ($input && $input.length) {
      $input.closest('form').on('submit', function (e) {
        e.preventDefault();
        searchShows();
      });
    }

    if (urlParams.genre != null) {
      var g = urlParams.genre;
      try { g = decodeURIComponent(String(g).replace(/\+/g, ' ')); } catch (e) { /* noop */ }
      searchShows(g);
      return;
    }

    if (urlParams.search_input != null) {
      try {
        var term = decodeURIComponent(String(urlParams.search_input).replace(/\+/g, ' '));
        if ($input && $input.length) $input.val(term);
      } catch (e) { /* ignore */ }
      searchShows();
    }
  });
})();

function searchShows(genre) {
  var $holder = $('#shows_holder');
  try { $holder.infiniteScroll('destroy'); } catch (e) { /* no-op */ }
  $holder.off('load.infiniteScroll');
  $holder.off('append.infiniteScroll');
  $holder.off('request.infiniteScroll');
  $holder.off('last.infiniteScroll');
  $holder.empty();
  $('#view_more').hide();

  var searchParam;
  var link;

  if (genre != null) {
    try { searchParam = decodeURIComponent(String(genre)); } catch (e) { searchParam = genre; }
    link = "/api/v1/shows/search_genre/";
  } else {
    searchParam = ($('#search_input').val() || '').trim();
    link = "/api/v1/shows/search/";
  }

  if (!genre && (!searchParam || searchParam.length === 0)) {
    var $input = $('#search_input');
    if ($input && $input.length) $input.focus();
    return;
  }

  var $container;
  var autoButtonTimer = null;
  var consecutiveEmptyPages = 0;
  var autoLoadCount = 0;
  try {
    $container = $holder.infiniteScroll({
      path: function () {
        var base = link;
        if (searchParam) base += encodeURIComponent(searchParam) + '/';
        return base + this.pageIndex;
      },
      responseType: 'text',
      loadOnScroll: true,
      prefill: false,
      scrollThreshold: 400,
      status: '.page-load-status',
      history: false
    });
  } catch (error) {
    console.log(error);
    return;
  }

  $('#view_more').show();
  var $viewMoreButton = $('.view-more-button');
  $viewMoreButton.hide();
  $viewMoreButton.off('click').on('click', function(){
    $container.infiniteScroll('loadNextPage');
  });

  $container.on('request.infiniteScroll', function(){
    clearTimeout(autoButtonTimer);
    $viewMoreButton.hide();
  });

  $container.on('load.infiniteScroll', function (event, response) {
    var data = JSON.parse(response);
    var results = (data.results || []).map(function (s) {
      if (!s.poster_path && s.backdrop_path) { s.poster_path = s.backdrop_path; }
      return s;
    });
    var itemsHTML = results.map(getItemHTML).filter(Boolean).join('');
    var $items = $(itemsHTML);
    $container.infiniteScroll('appendItems', $items);

    var appendedCount = $items.length;
    var totalPages = (data.total_pages || 0);
    var currentPage = (data.page || 0);
    if (appendedCount === 0 && totalPages && currentPage && currentPage < totalPages) {
      consecutiveEmptyPages++;
      if (consecutiveEmptyPages <= 2) {
        $container.infiniteScroll('loadNextPage');
        return;
      }
    } else {
      consecutiveEmptyPages = 0;
    }

    clearTimeout(autoButtonTimer);
    autoButtonTimer = setTimeout(function(){
      $viewMoreButton.show();
    }, 900);
  });

  $container.on('append.infiniteScroll', function(){
    autoLoadCount++;
    if (autoLoadCount >= 4) {
      $container.infiniteScroll('option', { loadOnScroll: false });
      $viewMoreButton.show();
    }
  });

  $container.on('last.infiniteScroll', function(){
    clearTimeout(autoButtonTimer);
    $viewMoreButton.hide();
  });

  $container.infiniteScroll('loadNextPage');
  $viewMoreButton.on('click', function(){
    autoLoadCount = 0;
    $container.infiniteScroll('option', { loadOnScroll: true });
    $viewMoreButton.hide();
  });

  var itemTemplateSrc = $('#show-template').html();

  function getItemHTML(show) {
    return microTemplate(itemTemplateSrc, show);
  }

  function microTemplate(src, data) {
    if (!data || data.poster_path == null || data.poster_path === "")
      return null;
    return src.replace(/\{\{([\w\-_\.]+)\}\}/gi, function (match, key) {
      var value = data;
      key.split('.').forEach(function (part) { value = value[part]; });
      return value;
    });
  }
}

function parseQueryString(url) {
  var urlParams = {};
  url.replace(new RegExp("([^?=&]+)(=([^&]*))?", "g"), function ($0, $1, $2, $3) {
    urlParams[$1] = $3;
  });
  return urlParams;
}
