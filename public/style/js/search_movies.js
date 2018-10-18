(function () {
    var urlParams = parseQueryString(location.search);

    if(urlParams.genre != null){
        searchMovies(urlParams.genre)
    }

})();

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

function searchMovies(genre) {
    $('#movies_holder').empty()
    $('#view_more').show()

    var searchParam;
    var link;

    if (genre != null){
         searchParam = genre;
         link = `/api/v1/movies/search_genre/`
    } else {
        searchParam = $('#search_input').val();
        link = `'/api/v1/movies/search/`
    }
    

    var $container = $('#movies_holder').infiniteScroll({
        path: function () {
            return link + searchParam + '/' + this.pageIndex;
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
        console.log("response", data)
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
        return microTemplate(itemTemplateSrc, movie);
    }

    // micro templating, sort-of
    function microTemplate(src, data) {
        if (data.backdrop_path == null || data.backdrop_path == "")
            return null
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
}