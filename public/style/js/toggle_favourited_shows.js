function checkIfFavouritedShow(user_id, show_id){
    $(`#add_favourited_show_${show_id}`).hide();
    $(`#remove_favourited_show_${show_id}`).hide();
    var link = `/api/v1/profile/shows/check/favourited/${user_id}/${show_id}`;
    if(user_id){ fetch(link).then(r=>r.json()).then(d=>{ if(d===true) $(`#remove_favourited_show_${show_id}`).show(); else $(`#add_favourited_show_${show_id}`).show(); }).catch(()=>{}); }
}

function showAddFavourited(user_id, show_id, user_key){
    var link = `/api/v1/profile/shows/favourited/add/`;
    let headers = new Headers(); headers.append('Content-Type','application/json');
    var init = { method:'POST', headers, body:`{ "user_id":"${user_id}", "user_key":"${user_key}", "show_id":"${show_id}" }`, cache:'no-cache', mode:'cors' };
    fetch(new Request(link, init)).catch(()=>{});
    $(`#add_favourited_show_${show_id}`).hide();
    $(`#remove_favourited_show_${show_id}`).show();
}

function showRemoveFavourited(user_id, show_id, user_key){
    var link = `/api/v1/profile/shows/favourited/remove/`;
    let headers = new Headers(); headers.append('Content-Type','application/json');
    var init = { method:'POST', headers, body:`{ "user_id":"${user_id}", "user_key":"${user_key}", "show_id":"${show_id}" }`, cache:'no-cache', mode:'cors' };
    fetch(new Request(link, init)).catch(()=>{});
    $(`#add_favourited_show_${show_id}`).show();
    $(`#remove_favourited_show_${show_id}`).hide();
}

