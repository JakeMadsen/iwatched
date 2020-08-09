(function () {
    var urlParams = parseQueryString(location.search);

    if(urlParams.genre != null){
        searchMovies(urlParams.genre)
    }

})();

function searchMovies(genre) {
    $('#movies_holder').empty()
    $('#view_more').show()
    console.log("searchMovies()", genre)
    var searchParam;
    var link;

    if (genre != null){
        console.log("got genre")
         searchParam = genre;
         link = `/api/v1/movies/search_genre/`
    } else {
        console.log("no genre")
        searchParam = $('#search_input').val();
        link = `/api/v1/movies/search/`
    }

    try {
        console.log("try")
        var $container = $('#movies_holder').infiniteScroll({
        path: function () {
            console.log("container function", link + searchParam + '/' + this.pageIndex)
            return link + searchParam + '/' + this.pageIndex;
        },
        // load response as flat text
        responseType: 'text',
        loadOnScroll: false,
        status: '.page-load-status',
        history: true
    });
    } catch (error) {
        console.log(error)
    }
    
    
console.log("viewmore")
    var $viewMoreButton = $('.view-more-button');
    $viewMoreButton.on('click', function () {
        console.log("view more button functio")
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
        console.log("load infinite scroll")
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
        console.log("getitemhtml")
        return microTemplate(itemTemplateSrc, movie);
    }

    // micro templating, sort-of
    function microTemplate(src, data) {
        console.log("micro template function")
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