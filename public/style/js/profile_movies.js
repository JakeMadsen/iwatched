function profileWatchedMovies(user_id) {
    $('#view_more').show()

    var link = `/api/v1/user-movies/watched/${user_id}/`;
    var host = location.origin;
    var posterlink = `/api/v1/movies/get_poster/`;

    var $container = $('#movies_holder').infiniteScroll({
        path: function () {
            return link + this.pageIndex;
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
        try { movie.slug = slugify(movie.title || movie.name || movie.movie_title || ''); } catch(_) { movie.slug = ''; }
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

function slugify(s){
    return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,80);
}

function profileFavouriteMovies(user_id){
    $('#view_more').show()

    var link = `/api/v1/user-movies/favourited/${user_id}/`;
    var host = location.origin;
    var posterlink = `/api/v1/movies/get_poster/`;

    var $container = $('#movies_holder').infiniteScroll({
        path: function () {
            return link + this.pageIndex;
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

function profileSavedMovies(user_id){
    $('#view_more').show()

    var link = `/api/v1/user-movies/saved/${user_id}/`;
    var host = location.origin;
    var posterlink = `/api/v1/movies/get_poster/`;

    var $container = $('#movies_holder').infiniteScroll({
        path: function () {
            return link + this.pageIndex;
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
