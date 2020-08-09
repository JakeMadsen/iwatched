function checkIfSaved(user_id, movie_id){
    $(`#add_saved_movie_${movie_id}`).hide()
    $(`#remove_saved_movie_${movie_id}`).hide()
    var link = `/api/v1/profile/movies/check/saved/${user_id}/${movie_id}`

    if(user_id){  
        fetch(link)
        .then(response => response.json())
        .then(data => {
            if(data == true)
                $(`#remove_saved_movie_${movie_id}`).show()
            if(data == false)
                $(`#add_saved_movie_${movie_id}`).show()

        })
        .catch(error => {
            console.log(error)
        })
    }
}

function movieAddSaved(user_id, movie_id, movie_runtime, user_key) {
    var link = `/api/v1/profile/movies/saved/add/`

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

    fetch(request)
        .then(response => {


        })
        .catch(err => {
            console.log(err)
        });

        $(`#add_saved_movie_${movie_id}`).hide()
        $(`#remove_saved_movie_${movie_id}`).show()


}

function movieRemoveSaved(user_id, movie_id, movie_runtime, user_key){
    var link = `/api/v1/profile/movies/saved/remove/`

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


    fetch(request)
        .then(response => {


        })
        .catch(err => {
            console.log(err)
        });

        $(`#add_saved_movie_${movie_id}`).show()
        $(`#remove_saved_movie_${movie_id}`).hide()
}