function checkIfWatchedShow(user_id, show_id){
    $(`#add_watched_show_${show_id}`).hide()
    $(`#remove_watched_show_${show_id}`).hide()
    var link = `/api/v1/profile/shows/check/watched/${user_id}/${show_id}`

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

function showAddWatched(user_id, show_id, show_runtime, user_key) {
    var link = `/api/v1/profile/shows/watched/add/`
    let headers = new Headers(); headers.append('Content-Type', 'application/json');
    var init = { method: 'POST', headers: headers, body: `{
            "user_id": "${user_id}",
            "user_key": "${user_key}",
            "show_id": "${show_id}",
            "show_runtime": "${show_runtime || ''}"
        }`, cache: 'no-cache', mode: 'cors' };
    fetch(new Request(link, init)).catch(()=>{});
    $(`#add_watched_show_${show_id}`).hide();
    $(`#remove_watched_show_${show_id}`).show();
}

function showRemoveWatched(user_id, show_id, show_runtime, user_key){
    var link = `/api/v1/profile/shows/watched/remove/`
    let headers = new Headers(); headers.append('Content-Type', 'application/json');
    var init = { method: 'POST', headers: headers, body: `{
            "user_id": "${user_id}",
            "user_key": "${user_key}",
            "show_id": "${show_id}",
            "show_runtime": "${show_runtime || ''}"
        }`, cache: 'no-cache', mode: 'cors' };
    fetch(new Request(link, init)).catch(()=>{});
    $(`#add_watched_show_${show_id}`).show();
    $(`#remove_watched_show_${show_id}`).hide();
}

