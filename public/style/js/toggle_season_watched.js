function checkIfSeasonWatched(user_id, show_id, season_number){
  const addId = `#add_watched_season_${show_id}_${season_number}`;
  const remId = `#remove_watched_season_${show_id}_${season_number}`;
  $(addId).hide(); $(remId).hide();
  var link = `/api/v1/user-shows/check/season/${user_id}/${show_id}/${season_number}`;
  if(user_id){ fetch(link).then(r=>r.json()).then(d=>{ if(d===true) $(remId).show(); else $(addId).show(); }).catch(()=>{}); }
}

function showSeasonComplete(user_id, show_id, season_number, user_key){
  var link = `/api/v1/user-shows/season/complete`;
  let headers = new Headers(); headers.append('Content-Type','application/json');
  var init = { method:'POST', headers, body: JSON.stringify({ user_id, user_key, show_id, season_number }), cache:'no-cache', mode:'cors' };
  fetch(new Request(link, init)).catch(()=>{});
  $(`#add_watched_season_${show_id}_${season_number}`).hide();
  $(`#remove_watched_season_${show_id}_${season_number}`).show();
  try { if (typeof checkIfWatchedShow === 'function') checkIfWatchedShow(user_id, show_id); } catch(_){}
}

function showSeasonUncomplete(user_id, show_id, season_number, user_key){
  var link = `/api/v1/user-shows/season/uncomplete`;
  let headers = new Headers(); headers.append('Content-Type','application/json');
  var init = { method:'POST', headers, body: JSON.stringify({ user_id, user_key, show_id, season_number }), cache:'no-cache', mode:'cors' };
  fetch(new Request(link, init)).catch(()=>{});
  $(`#add_watched_season_${show_id}_${season_number}`).show();
  $(`#remove_watched_season_${show_id}_${season_number}`).hide();
  try { if (typeof checkIfWatchedShow === 'function') checkIfWatchedShow(user_id, show_id); } catch(_){}
}

// Bulk toggle season UI on the show detail page after full show add/remove
function setAllSeasonsWatchedUI(show_id, watched){
  try {
    var addSel = `[id^='add_watched_season_${show_id}_']`;
    var remSel = `[id^='remove_watched_season_${show_id}_']`;
    var adds = document.querySelectorAll(addSel);
    var rems = document.querySelectorAll(remSel);
    adds.forEach(function(el){ el.style.display = watched ? 'none' : ''; });
    rems.forEach(function(el){ el.style.display = watched ? '' : 'none'; });
  } catch(_){}
}
