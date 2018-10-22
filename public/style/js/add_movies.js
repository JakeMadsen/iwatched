function movieAddWatched(user_id, movie_id, movie_runtime, user_key) {
    var link = `/api/v1/profile/movies/add/`

    let headers = new Headers();
        headers.append('Content-Type', 'application/json');

    var init = {
        method: 'POST',
        headers: headers,
        body: `{
            "user_id": "${user_id}",
            "user_key": "${user_key}",
            "movie_id": "${movie_id}",
            "movie_runtime": "${movie_runtime}"
        }`,
        cache: 'no-cache',
        mode: 'cors'
    };
    var request = new Request(link, init);
    console.log(init.body)

    fetch(request)
        .then(response => {
            console.log("Response", response, "Request sent to server", request.body)

        })
        .catch(err => {
            console.log(err)
        });

        $('#add_watched_movie').hide()

}
function movieAddWatchLater(user_id, movie_id, movie_runtime) {
    alert(`add ${movie_id} to ${user_id}`)


}
