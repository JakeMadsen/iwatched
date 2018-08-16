/* Fetch the movie database api*/
let tmdLink = "https://api.themoviedb.org/3/search/movie?api_key=",
    tmdApiKey = "ab4e974d12c288535f869686bd72e1da",
    tmdAdult = "false",
    movie_name = '',
    release_date = 'Unknown';


/* Movie search functions */
function searchAll(type) {
    let search_input = document.getElementById('search_input').value;
    let movie_placeholder = document.getElementById('movie_holder');
        movie_placeholder.innerHTML = null;

    fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${tmdApiKey}&language=en-US&query=${search_input}&page=1&include_adult=${tmdAdult}`)
        .then(response => {
            return response.json()
        })
        .then(results => {
            console.log(results)
            let movies = results.results
            console.log(movies)

            var movie_holder = document.createElement('DIV');
                movie_holder.classList.add('row')
            movies.forEach(movie => {
                /*  movie_option is the div that holds a specific movie */
                var movie_option = document.createElement('DIV');
                    movie_option.classList.add("movie_option")
                    movie_option.classList.add("col-md-12")

                /*  movie_option_row creates the rows for a specific movie */
                var movie_option_row = document.createElement('DIV');
                    movie_option_row.classList.add('row')
                movie_option.appendChild(movie_option_row)

                /*  movie_option_divider creates a divider between movies */
                var movie_option_divider = document.createElement('DIV');
                    movie_option_divider.classList.add('dropdown-divider');
                movie_option.appendChild(movie_option_divider)

                /*  movie_option_row_left creates the left side for a specific movie holding a image */
                var movie_option_row_left = document.createElement('DIV');
                    movie_option_row_left.classList.add('col-md-4')
                movie_option_row.appendChild(movie_option_row_left)

                /*  movie_option_row_right creates the right side for a specific movie holding information about the movie */
                var movie_option_row_right = document.createElement('DIV');
                    movie_option_row_right.classList.add('col-md-8');
                movie_option_row.appendChild(movie_option_row_right)
                
                /*  movie_image appends movie image to movie_option_row_left */
                var movie_image = document.createElement('IMG');
                    movie_image.classList.add('img-fluid')
                    movie_image.src = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                movie_option_row_left.appendChild(movie_image);

                /*  movie_title appends movie title to movie_option_row_right*/
                if(type == 'movie')
                    movie_name = movie.original_title;
                else
                    movie_name = movie.original_name;

                var movie_title = document.createElement('H4'),
                    movie_title_text = document.createTextNode(movie_name);
                    movie_title.appendChild(movie_title_text);
                movie_option_row_right.appendChild(movie_title);

                /*  movie_overview appends movie overview to movie_option_row_right*/
                var movie_overview = document.createElement('P'),
                    movie_overview_text = document.createTextNode(movie.overview);
                    movie_overview.appendChild(movie_overview_text);
                movie_option_row_right.appendChild(movie_overview);

                /*  movie_rating appends movie rating to movie_option_row_right*/
                let rating;
                if(movie.vote_count != 0)
                    rating = "Movie rating: " + movie.vote_average + "/10" + " Total votes: " + movie.vote_count;
                else
                    rating = "This movie has not been rated yet.";
                
                var movie_rating = document.createElement('P'),
                    movie_rating_text = document.createTextNode(rating);
                    movie_rating.appendChild(movie_rating_text);
                movie_option_row_right.appendChild(movie_rating);

                /*  movie_release appends movie rating to movie_option_row_right*/
                if(type == 'movie')
                release_date = movie.release_date;
                else
                release_date = movie.first_air_date;
                var movie_release = document.createElement('P'),
                    movie_release_text = document.createTextNode("Release date: " + release_date);
                    movie_release.appendChild(movie_release_text);
                movie_option_row_right.appendChild(movie_release);

                /*  movie_add_watched appends movie rating to movie_option_row_right*/
                var movie_add_watched = document.createElement('BUTTON'),
                    movie_add_watched_text = document.createTextNode("I watched this");
                    movie_add_watched.id = "watched_"+movie.id;
                    movie_add_watchedAtt = document.createAttribute('onclick');
                    movie_add_watchedAtt.value = `addToWatched(${movie.id}, "${type}");`;
                    movie_add_watched.setAttributeNode(movie_add_watchedAtt)
                    movie_add_watched.appendChild(movie_add_watched_text);
                movie_option_row_right.appendChild(movie_add_watched);

                /*  movie_add_watch_later appends movie rating to movie_option_row_right*/
                var movie_add_watch_later = document.createElement('BUTTON'),
                    movie_add_watch_later_text = document.createTextNode("Save this for later");
                    movie_add_watch_later.id = "later_"+movie.id
                    movie_add_watch_later.appendChild(movie_add_watch_later_text);
                movie_option_row_right.appendChild(movie_add_watch_later);

                movie_holder.appendChild(movie_option)
            });
            return movie_holder
        })
        .then(movies_div => {
            movie_placeholder.appendChild(movies_div)
        })
        return false;
}
function addToWatched(id, type){
    event.preventDefault();
    type = (type == "tv") ? "series" : "movies"
    
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    
    let init = {
        method: 'POST',
        headers: headers,
        credentials: "same-origin",
        body: `{
            "add_watched_id":"${id}",
            "add_watched_type":"${type}"}`,
        cache: 'no-cache',
    };
    

    let request = new Request(`http://localhost:3300/profile/watched/add`, init);
    console.log(request)    
        fetch(request)
            .then(response => { console.log(response) }).catch(err => { console.log(err) });
}