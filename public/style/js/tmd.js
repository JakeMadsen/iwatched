/* Fetch the movie database api*/
let tmdLink = "https://api.themoviedb.org/3/search/movie?api_key=",
    tmdApiKey = "ab4e974d12c288535f869686bd72e1da",
    tmdAdult = "false";


/* Movie search functions */
function searchMovies() {
    let search_input = document.getElementById('search_input').value;
    let movie_placeholder = document.getElementById('movie_holder');
        movie_placeholder.innerHTML = null;

    fetch(`https://api.themoviedb.org/3/search/movie?api_key=ab4e974d12c288535f869686bd72e1da&language=en-US&query=${search_input}&page=1&include_adult=false`)
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
                var movie_title = document.createElement('H4'),
                    movie_title_text = document.createTextNode(movie.original_title);
                    movie_title.appendChild(movie_title_text);
                movie_option_row_right.appendChild(movie_title);

                /*  movie_overview appends movie overview to movie_option_row_right*/
                var movie_overview = document.createElement('P'),
                    movie_overview_text = document.createTextNode(movie.overview);
                    movie_overview.appendChild(movie_overview_text);
                movie_option_row_right.appendChild(movie_overview);

                /*  movie_rating appends movie rating to movie_option_row_right*/
                var movie_rating = document.createElement('P'),
                    movie_rating_text = document.createTextNode("Movie rating: " + movie.vote_average + "/10" + " Total votes: " + movie.vote_count);
                    movie_rating.appendChild(movie_rating_text);
                movie_option_row_right.appendChild(movie_rating);

                /*  movie_add_watched appends movie rating to movie_option_row_right*/
                var movie_add_watched = document.createElement('BUTTON'),
                    movie_add_watched_text = document.createTextNode("I watched this");
                    movie_add_watched.appendChild(movie_add_watched_text);
                movie_option_row_right.appendChild(movie_add_watched);

                /*  movie_add_watch_later appends movie rating to movie_option_row_right*/
                var movie_add_watch_later = document.createElement('BUTTON'),
                    movie_add_watch_later_text = document.createTextNode("Save this for later");
                    movie_add_watch_later.appendChild(movie_add_watch_later_text);
                movie_option_row_right.appendChild(movie_add_watch_later);
              
                

                movie_holder.appendChild(movie_option)

            });
            return movie_holder
        })
        .then(movies_div => {
            movie_placeholder.appendChild(movies_div)
        })
}