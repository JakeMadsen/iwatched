function checkIfWatched(user_id, movie_id){
    if(!user_id || !movie_id){ return; }
    try {
      if (window.StatusStore){
        $(`#add_watched_movie_${movie_id}`).hide();
        $(`#remove_watched_movie_${movie_id}`).hide();
        StatusStore.getOne('movie', String(movie_id)).then(function(st){
          if(st && st.w===true) $(`#remove_watched_movie_${movie_id}`).show(); else $(`#add_watched_movie_${movie_id}`).show();
        });
        return;
      }
    } catch(_){}
    $(`#add_watched_movie_${movie_id}`).hide();
    $(`#remove_watched_movie_${movie_id}`).hide();
    var link = `/api/v1/user-movies/check/watched/${user_id}/${movie_id}`;
    fetch(link)
      .then(function(response){ try { return response.ok ? response.json() : false; } catch(_) { return false; } })
      .then(function(data){
        if(data === true) $(`#remove_watched_movie_${movie_id}`).show();
        else $(`#add_watched_movie_${movie_id}`).show();
      })
      .catch(function(error){ try { console.log(error); } catch(_){} });
}

async function movieAddWatched(user_id, movie_id, movie_runtime, user_key) {
    var link = `/api/v1/user-movies/watch/add`;

    let headers = new Headers();
    headers.append('Content-Type', 'application/json');

    var init = {
        method: 'POST',
        headers: headers,
        body: `{
            "user_id": "${user_id}",
            "user_key": "${user_key}",
            "movie_id": "${movie_id}",
            "movie_runtime": "${movie_runtime || ''}"
        }`,
        cache: 'no-cache',
        mode: 'cors'
    };
    var request = new Request(link, init);

    try {
        const resp = await fetch(request);
        if (!resp.ok) throw new Error('request_failed');
        const data = await resp.json().catch(()=>({ status: 'ok' }));
        if (data && (data.status === 'ok' || data.status === 200)){
            $(`#add_watched_movie_${movie_id}`).hide();
            $(`#remove_watched_movie_${movie_id}`).show();
            try { if (window.StatusStore) StatusStore.put('movie', String(movie_id), { w:true, f:null, s:null }); } catch(_){}
        } else { throw new Error('bad_status'); }
    } catch (err) {
        // Revert UI if failed (likely auth key or network)
        $(`#add_watched_movie_${movie_id}`).show();
        $(`#remove_watched_movie_${movie_id}`).hide();
        try { console.warn('Add watched failed for', movie_id, err && err.message); } catch(_){}
    }
}

async function movieRemoveWatched(user_id, movie_id, movie_runtime, user_key){
    var link = `/api/v1/user-movies/watch/remove`;

    let headers = new Headers();
    headers.append('Content-Type', 'application/json');

    var init = {
        method: 'POST',
        headers: headers,
        body: `{
            "user_id": "${user_id}",
            "user_key": "${user_key}",
            "movie_id": "${movie_id}",
            "movie_runtime": "${movie_runtime || ''}"
        }`,
        cache: 'no-cache',
        mode: 'cors'
    };
    var request = new Request(link, init);

    try {
        const resp = await fetch(request);
        if (!resp.ok) throw new Error('request_failed');
        const data = await resp.json().catch(()=>({ status: 'ok' }));
        if (data && (data.status === 'ok' || data.status === 200)){
            $(`#add_watched_movie_${movie_id}`).show();
            $(`#remove_watched_movie_${movie_id}`).hide();
            try { if (window.StatusStore) StatusStore.put('movie', String(movie_id), { w:false, f:null, s:null }); } catch(_){}
        } else { throw new Error('bad_status'); }
    } catch (err) {
        // Revert UI if failed
        $(`#add_watched_movie_${movie_id}`).hide();
        $(`#remove_watched_movie_${movie_id}`).show();
        try { console.warn('Remove watched failed for', movie_id, err && err.message); } catch(_){}
    }
}
