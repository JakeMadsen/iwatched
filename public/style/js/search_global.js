// Simple global search dropdown for navbar — initializes on DOMContentLoaded
(function(){
  function slugify(str){
    return String(str||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substr(0,80);
  }

  function init(){
    var input = document.getElementById('nav_search');
    var form = document.getElementById('nav_search_form');
    var menu = document.getElementById('nav_search_results');
    if(!input || !form || !menu) return;

    var timer = null;
    var lastQ = '';
    var selIndex = -1;

    function clearMenu(){ menu.innerHTML=''; menu.classList.remove('show'); menu.style.display='none'; selIndex=-1; }

    function renderGroup(title, items){
      if(!items || items.length===0) return '';
      var html = '<h6 class="dropdown-header">'+title+'</h6>';
      items.forEach(function(it){ html += it; });
      html += '<div class="dropdown-divider"></div>';
      return html;
    }

    function buildItem(href, iconHtml, text, meta){
      var m = meta ? '<small style="opacity:.75; margin-left:6px;">'+meta+'</small>' : '';
      return '<a class="dropdown-item nav-search-item" data-href="'+href+'" href="'+href+'">'+iconHtml+' '+text+m+'</a>';
    }

    function applySelection(){
      var items = menu.querySelectorAll('.nav-search-item');
      items.forEach(function(a,i){ if(i===selIndex) a.classList.add('active'); else a.classList.remove('active'); });
    }

    function search(q){
      if(!q){ clearMenu(); return; }
      fetch('/api/v1/search?q='+encodeURIComponent(q)+'&limit=5')
        .then(function(r){ return r.json(); })
        .then(function(data){
          var html = '';
          html += renderGroup('Movies', (data.movies||[]).map(function(m){
            var href = '/movies/'+m.id+'-'+slugify(m.title||'');
            return buildItem(href, '<i class="fas fa-film"></i>', m.title, (m.release_date||'').slice(0,4));
          }));
          html += renderGroup('Shows', (data.shows||[]).map(function(s){
            var href = '/shows/'+s.id+'-'+slugify(s.name||'');
            return buildItem(href, '<i class="fas fa-tv"></i>', s.name, (s.first_air_date||'').slice(0,4));
          }));
          html += renderGroup('Persons', (data.persons||[]).map(function(p){
            return buildItem('/person/'+p.id, '<i class="fas fa-user-circle"></i>', p.name, 'Person');
          }));
          html += renderGroup('Users', (data.users||[]).map(function(u){
            var slug = u.slug ? '/'+u.slug : '/'+u.id;
            return buildItem(slug, '<i class="fas fa-user"></i>', u.username || u.slug || 'User', u.slug ? '@'+u.slug : '');
          }));
          if(!html){ html = '<span class="dropdown-item-text" style="opacity:.75;">No results</span>'; }
          menu.innerHTML = html;
          menu.classList.add('show');
          menu.style.display = 'block';
          selIndex = -1;
        })
        .catch(function(){ clearMenu(); });
    }

    input.addEventListener('input', function(){
      var q = input.value.trim();
      if(q === lastQ) return;
      lastQ = q;
      clearTimeout(timer);
      timer = setTimeout(function(){ search(q); }, 250);
    });

    input.addEventListener('keydown', function(e){
      if(!menu.classList.contains('show')) return;
      var items = menu.querySelectorAll('.nav-search-item');
      if(e.key === 'ArrowDown'){
        e.preventDefault();
        if(items.length===0) return; selIndex = (selIndex+1) % items.length; applySelection();
      } else if(e.key === 'ArrowUp'){
        e.preventDefault();
        if(items.length===0) return; selIndex = (selIndex-1+items.length) % items.length; applySelection();
      } else if(e.key === 'Enter'){
        if(selIndex >= 0 && items[selIndex]){
          e.preventDefault();
          window.location.href = items[selIndex].getAttribute('data-href');
        }
      } else if(e.key === 'Escape'){
        clearMenu();
      }
    });

    input.addEventListener('focus', function(){ if(input.value.trim()){ search(input.value.trim()); }});
    document.addEventListener('click', function(ev){ if(!form.contains(ev.target)) clearMenu(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
