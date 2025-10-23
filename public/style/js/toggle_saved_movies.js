function checkIfSaved(user_id, movie_id){
    if(!user_id || !movie_id){ return; }
    $(`#add_saved_movie_${movie_id}`).hide();
    $(`#remove_saved_movie_${movie_id}`).hide();
    var link = `/api/v1/user-movies/check/saved/${user_id}/${movie_id}`;
    fetch(link)
      .then(function(response){ try { return response.ok ? response.json() : false; } catch(_) { return false; } })
      .then(function(data){
        if(data === true) $(`#remove_saved_movie_${movie_id}`).show();
        else $(`#add_saved_movie_${movie_id}`).show();
      })
      .catch(function(error){ try { console.log(error); } catch(_){} });
}

function movieAddSaved(user_id, movie_id, movie_runtime, user_key) {
    var link = `/api/v1/user-movies/bookmark/add`;

    let headers = new Headers();
    headers.append('Content-Type', 'application/json');

    var init = {
        method: 'POST',
        headers: headers,
        body: `{
            "user_id": "${user_id}",
            "user_key": "${user_key}",
            "movie_id": "${movie_id}"
        }`,
        cache: 'no-cache',
        mode: 'cors'
    };
    var request = new Request(link, init);

    fetch(request).catch(function(err){ try { console.log(err); } catch(_){} });

    $(`#add_saved_movie_${movie_id}`).hide();
    $(`#remove_saved_movie_${movie_id}`).show();
}

function movieRemoveSaved(user_id, movie_id, movie_runtime, user_key){
    var link = `/api/v1/user-movies/bookmark/remove`;

    let headers = new Headers();
    headers.append('Content-Type', 'application/json');

    var init = {
        method: 'POST',
        headers: headers,
        body: `{
            "user_id": "${user_id}",
            "user_key": "${user_key}",
            "movie_id": "${movie_id}"
        }`,
        cache: 'no-cache',
        mode: 'cors'
    };
    var request = new Request(link, init);

    fetch(request).catch(function(err){ try { console.log(err); } catch(_){} });

    $(`#add_saved_movie_${movie_id}`).show();
    $(`#remove_saved_movie_${movie_id}`).hide();
}
