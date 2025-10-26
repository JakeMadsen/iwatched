function checkIfSavedShow(user_id, show_id){
    $(`#add_saved_show_${show_id}`).hide();
    $(`#remove_saved_show_${show_id}`).hide();
    try {
      if (window.StatusStore){
        StatusStore.getOne('show', String(show_id)).then(function(st){ if(st && st.s===true) $(`#remove_saved_show_${show_id}`).show(); else $(`#add_saved_show_${show_id}`).show(); });
        return;
      }
    } catch(_){}
    var link = `/api/v1/user-shows/check/saved/${user_id}/${show_id}`;
    if(user_id){ fetch(link).then(r=>r.json()).then(d=>{ if(d===true) $(`#remove_saved_show_${show_id}`).show(); else $(`#add_saved_show_${show_id}`).show(); }).catch(()=>{}); }
}

function showAddSaved(user_id, show_id, user_key){
    var link = `/api/v1/user-shows/bookmark/add`;
    let headers = new Headers(); headers.append('Content-Type','application/json');
    var init = { method:'POST', headers, body:`{ "user_id":"${user_id}", "user_key":"${user_key}", "show_id":"${show_id}" }`, cache:'no-cache', mode:'cors' };
    fetch(new Request(link, init)).catch(()=>{});
    $(`#add_saved_show_${show_id}`).hide();
    $(`#remove_saved_show_${show_id}`).show();
    try { if (window.StatusStore) StatusStore.put('show', String(show_id), { s:true, w:null, f:null }); } catch(_){}
}

function showRemoveSaved(user_id, show_id, user_key){
    var link = `/api/v1/user-shows/bookmark/remove`;
    let headers = new Headers(); headers.append('Content-Type','application/json');
    var init = { method:'POST', headers, body:`{ "user_id":"${user_id}", "user_key":"${user_key}", "show_id":"${show_id}" }`, cache:'no-cache', mode:'cors' };
    fetch(new Request(link, init)).catch(()=>{});
    $(`#add_saved_show_${show_id}`).show();
    $(`#remove_saved_show_${show_id}`).hide();
    try { if (window.StatusStore) StatusStore.put('show', String(show_id), { s:false, w:null, f:null }); } catch(_){}
}
