(function() {
  'use strict';

  var playerCache = null;
  var debounceTimer = null;
  var isLoading = false;
  var pendingCallbacks = [];

  function normalizeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function getCachedPlayers() {
    try {
      var cached = sessionStorage.getItem('playerSearchCache');
      if (!cached) return null;
      var data = JSON.parse(cached);
      if (Date.now() - data.ts > 3600000) {
        sessionStorage.removeItem('playerSearchCache');
        return null;
      }
      return data.players;
    } catch (e) {
      return null;
    }
  }

  function setCachedPlayers(players) {
    try {
      sessionStorage.setItem('playerSearchCache', JSON.stringify({ players: players, ts: Date.now() }));
    } catch (e) { /* ignore quota errors */ }
  }

  function loadPlayers(callback) {
    if (playerCache) { callback(playerCache); return; }
    var cached = getCachedPlayers();
    if (cached) { playerCache = cached; callback(cached); return; }
    pendingCallbacks.push(callback);
    if (isLoading) return;
    isLoading = true;
    fetch('/api/players')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        playerCache = data.players;
        setCachedPlayers(data.players);
        isLoading = false;
        var cbs = pendingCallbacks.slice();
        pendingCallbacks = [];
        cbs.forEach(function(cb) { cb(playerCache); });
      })
      .catch(function() {
        isLoading = false;
        pendingCallbacks = [];
      });
  }

  function searchPlayers(players, query) {
    if (!query || query.length < 2) return [];
    var q = normalizeAccents(query);
    var startsWithName = [];
    var startsWithLast = [];
    var contains = [];

    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var norm = normalizeAccents(p.name);
      var parts = norm.split(/\s+/);
      var lastName = parts[parts.length - 1];

      if (norm.indexOf(q) === 0) {
        startsWithName.push(p);
      } else if (lastName.indexOf(q) === 0) {
        startsWithLast.push(p);
      } else if (norm.indexOf(q) !== -1) {
        contains.push(p);
      }
    }

    return startsWithName.concat(startsWithLast, contains).slice(0, 8);
  }

  function renderDropdown(results, dropdown, query) {
    if (!query || query.length < 2) {
      dropdown.style.display = 'none';
      return;
    }

    if (results.length === 0) {
      dropdown.innerHTML = '<div class="player-search-empty">No players found</div>';
      dropdown.style.display = 'block';
      return;
    }

    var html = '';
    for (var i = 0; i < results.length; i++) {
      var p = results[i];
      var posMap = { GK: 'GK', CB: 'D', FB: 'D', LB: 'D', RB: 'D', CM: 'M', DM: 'M', AM: 'M', W: 'M', LW: 'M', RW: 'M', WM: 'M', WF: 'M', ST: 'F', CF: 'F', FW: 'F' };
      var pos = (p.position && posMap[p.position.toUpperCase()]) || '';
      html += '<a class="player-search-item" href="/player.html?id=' + p.slug + '">';
      html += '<span class="player-search-name">' + p.name + '</span>';
      html += '<span class="player-search-meta">' + pos + (pos ? ' &middot; ' : '') + p.seasonsRange + '</span>';
      html += '</a>';
    }

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
  }

  function showLoading(dropdown) {
    dropdown.innerHTML = '<div class="player-search-empty">Searching...</div>';
    dropdown.style.display = 'block';
  }

  function init() {
    var wrapper = document.querySelector('.player-search');
    if (!wrapper) return;

    var input = wrapper.querySelector('.player-search-input');
    var dropdown = wrapper.querySelector('.player-search-dropdown');
    if (!input || !dropdown) return;

    function doSearch() {
      var query = input.value.trim();
      if (query.length < 2) {
        dropdown.style.display = 'none';
        return;
      }
      if (!playerCache) {
        showLoading(dropdown);
        loadPlayers(function() { doSearch(); });
        return;
      }
      var results = searchPlayers(playerCache, query);
      renderDropdown(results, dropdown, query);
    }

    input.addEventListener('focus', function() {
      loadPlayers(function() {});
      if (input.value.trim().length >= 2) doSearch();
    });

    input.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 300);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        input.blur();
      }
    });

    document.addEventListener('click', function(e) {
      if (!wrapper.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
