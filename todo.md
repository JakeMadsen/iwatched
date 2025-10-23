## TODO list

### Monitization 
* Paid tier
    no ads
    add how many times you have seen a movie / show
    Access to fun stats
* Free tier
    has ads

### Cool stuff
Make personal notes about movies / shows
Do reviews


### Personaliztion 
Achievments
Badges
Showcases

### Social stuff
Reccomend TV series / Movies directly to friends (which lands in a dedicated list that can be sorted by genre, movie/show, who recommended it)




### New User Movie Database Structuring
var userMovieSchema = mongoose.Schema({
    user_id: user_id,
    movie_id: tmdb_id,
    movie_runtime: number,
    movie_watched: timestamp, 
    movie_watched_count: number,
    movie_bookmarked: timestamp,
    movie_favorite: timestamp,
    personal_note: string,
    personal_rating: number,
    date_updated: timestamp 
});

var userMovieTotals = mongoose.Schema({
    user_id: user_id,
    unique_movies_watched: ,
    total_movies_watched: ,
    total_runtime: ,
});


Here’s your schema with concise notes appended per line.

var userMovieSchema = mongoose.Schema({
user_id: user_id,          (User ID)             — Required; index; part of unique compound (user_id, movie_id)
movie_id: tmdb_id,         (TMDB movie ID)       — Required Number; unique with user_id
movie_runtime: number,     (Runtime of movie)    — Rename to runtime_minutes:Number; set once on first watch
movie_watched: date,       (Movie marked as watched)                    — Drop; derive from watched_count>0; use first/last_watched timestamps
movie_watched_count: number,       (How many times they have watched the movie) — Keep Number, default 0; never negative
movie_bookmarked: date,    (Bookmarked for later)                       — Keep as bookmarked_at Date; present=on, absent=off
movie_favorite: date,      (Saved as favorite)                          — Keep as favourited_at Date; present=on, absent=off
personal_note: string,     (A personal note about the movie)            — Keep inline short; separate collection only if you need history/large text
first_watched: date,       (Can be manually set with UI calendar)       — Keep nullable; set on first watch or manual edit
last_watched: date,        (Can be manually set with UI calendar)       — Keep; update on increment or manual edit
date_added: timestamp,          (When they added the movie the first time, nothing to do with watched, saved or bookmarked) — Replace with createdAt via { timestamps: true }
date_updated: timestamp         (Last time they interacted with the movie at all) — Replace with updatedAt via { timestamps: true }
});

var userMovieTotals = mongoose.Schema({
user_id: user_id,        (User ID) — Required unique; one totals doc per user
unique_movies_watched: , (How many unique movies they have watched) — Number; rename distinct_movies; +1 on first watch of a movie, -1 when watched_count hits 0
total_movies_watched: ,  (How many movies they have watched in total including rewatches) — Number; rename watch_events; +1/-1 per add/remove
total_runtime: ,         (Total runtime of all movies they have watched including rewatches) — Number minutes; rename total_runtime_minutes; +=/-= runtime_minutes per add/remove
});
