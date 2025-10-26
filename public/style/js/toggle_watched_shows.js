function checkIfWatchedShow(user_id, show_id){
    const addSel = `#add_watched_show_${show_id}`;
    const remSel = `#remove_watched_show_${show_id}`;
    $(addSel).hide(); $(remSel).hide();
    // 1) Optimistic read from StatusStore if present
    try {
      if (window.StatusStore){
        StatusStore.getOne('show', String(show_id)).then(function(st){
          if (st && st.w===true) $(remSel).show(); else $(addSel).show();
        });
      }
    } catch(_){}
    // 2) Always validate via API so season completion counts as watched
    var link = `/api/v1/user-shows/check/watched/${user_id}/${show_id}`
    if(user_id){  
        fetch(link)
        .then(response => response.json())
        .then(data => {
            if(data === true){
                $(remSel).show(); $(addSel).hide();
                try { if (window.StatusStore) StatusStore.put('show', String(show_id), { w:true, f:null, s:null }); } catch(_){}
            } else {
                $(addSel).show(); $(remSel).hide();
                try { if (window.StatusStore) StatusStore.put('show', String(show_id), { w:false, f:null, s:null }); } catch(_){}
            }
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
    try { if (window.StatusStore) StatusStore.put('show', String(show_id), { w:true, f:null, s:null }); } catch(_){}
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
    try { if (window.StatusStore) StatusStore.put('show', String(show_id), { w:false, f:null, s:null }); } catch(_){}
}
