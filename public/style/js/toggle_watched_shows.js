function checkIfWatchedShow(user_id, show_id){
    $(`#add_watched_show_${show_id}`).hide()
    $(`#remove_watched_show_${show_id}`).hide()
    var link = `/api/v1/user-shows/check/watched/${user_id}/${show_id}`

    if(user_id){  
        fetch(link)
        .then(response => response.json())
        .then(data => {
            if(data == true)
                $(`#remove_watched_show_${show_id}`).show()
            if(data == false)
                $(`#add_watched_show_${show_id}`).show()
        })
        .catch(error => { console.log(error) })
    }
}

// Mark entire show as watched (all seasons)
function showAddWatched(user_id, show_id, show_runtime, user_key) {
    var link = `/api/v1/user-shows/show/complete`
    let headers = new Headers(); headers.append('Content-Type', 'application/json');
    var init = { method: 'POST', headers: headers, body: `{
            "user_id": "${user_id}",
            "user_key": "${user_key}",
            "show_id": "${show_id}"
        }`, cache: 'no-cache', mode: 'cors' };
    fetch(new Request(link, init)).then(function(){
        try { if (typeof setAllSeasonsWatchedUI === 'function') setAllSeasonsWatchedUI(show_id, true); } catch(_){}
    }).catch(()=>{});
    $(`#add_watched_show_${show_id}`).hide();
    $(`#remove_watched_show_${show_id}`).show();
}

function showRemoveWatched(user_id, show_id, show_runtime, user_key){
    var link = `/api/v1/user-shows/show/uncomplete`
    let headers = new Headers(); headers.append('Content-Type', 'application/json');
    var init = { method: 'POST', headers: headers, body: `{
            "user_id": "${user_id}",
            "user_key": "${user_key}",
            "show_id": "${show_id}"
        }`, cache: 'no-cache', mode: 'cors' };
    fetch(new Request(link, init)).then(function(){
        try { if (typeof setAllSeasonsWatchedUI === 'function') setAllSeasonsWatchedUI(show_id, false); } catch(_){}
    }).catch(()=>{});
    $(`#add_watched_show_${show_id}`).show();
    $(`#remove_watched_show_${show_id}`).hide();
}
