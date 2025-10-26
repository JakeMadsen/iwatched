function checkIfFavourited(user_id, movie_id){
    if(!user_id || !movie_id){ return; }
    try {
      if (window.StatusStore){
        $(`#add_favourited_movie_${movie_id}`).hide();
        $(`#remove_favourited_movie_${movie_id}`).hide();
        StatusStore.getOne('movie', String(movie_id)).then(function(st){
          if(st && st.f===true) $(`#remove_favourited_movie_${movie_id}`).show(); else $(`#add_favourited_movie_${movie_id}`).show();
        });
        return;
      }
    } catch(_){}
    $(`#add_favourited_movie_${movie_id}`).hide();
    $(`#remove_favourited_movie_${movie_id}`).hide();
    var link = `/api/v1/user-movies/check/favourited/${user_id}/${movie_id}`;
    fetch(link)
      .then(function(response){ try { return response.ok ? response.json() : false; } catch(_) { return false; } })
      .then(function(data){
        if(data === true) $(`#remove_favourited_movie_${movie_id}`).show();
        else $(`#add_favourited_movie_${movie_id}`).show();
      })
      .catch(function(error){ try { console.log(error); } catch(_){} });
}

function movieAddFavourited(user_id, movie_id, movie_runtime, user_key) {
    var link = `/api/v1/user-movies/favourited/add`;

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

    $(`#add_favourited_movie_${movie_id}`).hide();
    $(`#remove_favourited_movie_${movie_id}`).show();
    try { if (window.StatusStore) StatusStore.put('movie', String(movie_id), { f:true, w:null, s:null }); } catch(_){}
}

function movieRemoveFavourited(user_id, movie_id, movie_runtime, user_key){
    var link = `/api/v1/user-movies/favourited/remove`;

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

    fetch(request).catch(function(err){});

    $(`#add_favourited_movie_${movie_id}`).show();
    $(`#remove_favourited_movie_${movie_id}`).hide();
    try { if (window.StatusStore) StatusStore.put('movie', String(movie_id), { f:false, w:null, s:null }); } catch(_){}
}
