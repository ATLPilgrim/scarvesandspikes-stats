(function() {
  'use strict';

  // Auto-expire after the event week
  if (new Date() > new Date('2026-03-08T00:00:00')) return;

  // ─── Critter definitions ───────────────────────────────────────────
  const CRITTERS = [
    {
      id: 'spike',
      name: 'Spike',
      description: 'A golden railroad spike with eyes and tiny legs',
      svg: '<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">' +
        '<polygon points="20,2 26,14 24,38 16,38 14,14" fill="#c9a227" stroke="#8a6d0b" stroke-width="1"/>' +
        '<polygon points="14,14 26,14 28,18 12,18" fill="#e0b830" stroke="#8a6d0b" stroke-width="1"/>' +
        '<circle cx="17" cy="12" r="1.5" fill="#333"/>' +
        '<circle cx="23" cy="12" r="1.5" fill="#333"/>' +
        '<line x1="18" y1="15" x2="22" y2="15" stroke="#333" stroke-width="1" stroke-linecap="round"/>' +
        '<line x1="14" y1="38" x2="11" y2="40" stroke="#8a6d0b" stroke-width="2" stroke-linecap="round"/>' +
        '<line x1="18" y1="38" x2="16" y2="40" stroke="#8a6d0b" stroke-width="2" stroke-linecap="round"/>' +
        '<line x1="22" y1="38" x2="24" y2="40" stroke="#8a6d0b" stroke-width="2" stroke-linecap="round"/>' +
        '<line x1="26" y1="38" x2="29" y2="40" stroke="#8a6d0b" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>'
    },
    {
      id: 'fivenix',
      name: 'Fivenix',
      description: 'A burgundy phoenix with 5 tail feathers',
      svg: '<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="20" cy="18" rx="8" ry="10" fill="#80000a"/>' +
        '<polygon points="16,6 20,2 24,6 20,10" fill="#c9a227"/>' +
        '<circle cx="17" cy="15" r="1.5" fill="#c9a227"/>' +
        '<circle cx="23" cy="15" r="1.5" fill="#c9a227"/>' +
        '<polygon points="18,19 22,19 20,22" fill="#c9a227"/>' +
        '<polygon points="10,28 8,38 12,34 14,26" fill="#80000a" opacity="0.9"/>' +
        '<polygon points="14,29 11,39 16,35 17,27" fill="#a00010" opacity="0.9"/>' +
        '<polygon points="18,30 17,40 22,36 21,28" fill="#c9a227" opacity="0.9"/>' +
        '<polygon points="23,29 25,39 27,35 25,27" fill="#a00010" opacity="0.9"/>' +
        '<polygon points="26,28 30,38 28,34 26,26" fill="#80000a" opacity="0.9"/>' +
        '<polygon points="8,16 5,12 10,15" fill="#80000a"/>' +
        '<polygon points="32,16 35,12 30,15" fill="#80000a"/>' +
        '</svg>'
    },
    {
      id: 'peachsnap',
      name: 'Peachsnap',
      description: 'A peach with a mischievous face and leaf antenna',
      svg: '<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="20" cy="24" rx="12" ry="13" fill="#f4a460"/>' +
        '<ellipse cx="20" cy="24" rx="12" ry="13" fill="url(#peachGrad)" />' +
        '<defs><radialGradient id="peachGrad" cx="40%" cy="35%"><stop offset="0%" stop-color="#ffc68a"/><stop offset="100%" stop-color="#e8834a"/></radialGradient></defs>' +
        '<path d="M20,11 Q20,6 18,4" stroke="#5a8c2a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="22" cy="6" rx="5" ry="3" fill="#5a8c2a" transform="rotate(-20,22,6)"/>' +
        '<circle cx="15" cy="22" r="2" fill="#333"/>' +
        '<circle cx="25" cy="22" r="2" fill="#333"/>' +
        '<circle cx="15.8" cy="21.3" r="0.7" fill="#fff"/>' +
        '<circle cx="25.8" cy="21.3" r="0.7" fill="#fff"/>' +
        '<path d="M16,28 Q20,32 24,28" stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="11" cy="26" rx="3" ry="2" fill="#f08080" opacity="0.4"/>' +
        '<ellipse cx="29" cy="26" rx="3" ry="2" fill="#f08080" opacity="0.4"/>' +
        '</svg>'
    },
    {
      id: 'halowing',
      name: 'Halowing',
      description: 'A small owl with a glowing gold halo',
      svg: '<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="20" cy="7" rx="8" ry="3" fill="none" stroke="#c9a227" stroke-width="2" opacity="0.8"/>' +
        '<ellipse cx="20" cy="7" rx="8" ry="3" fill="none" stroke="#ffe066" stroke-width="1" opacity="0.5"/>' +
        '<ellipse cx="20" cy="24" rx="10" ry="12" fill="#5c4033"/>' +
        '<ellipse cx="20" cy="26" rx="7" ry="8" fill="#d2b48c"/>' +
        '<circle cx="15" cy="20" r="4" fill="#fff" stroke="#5c4033" stroke-width="1"/>' +
        '<circle cx="25" cy="20" r="4" fill="#fff" stroke="#5c4033" stroke-width="1"/>' +
        '<circle cx="15" cy="20" r="2" fill="#333"/>' +
        '<circle cx="25" cy="20" r="2" fill="#333"/>' +
        '<polygon points="18,24 20,27 22,24" fill="#c9a227"/>' +
        '<polygon points="8,22 4,28 12,26" fill="#5c4033"/>' +
        '<polygon points="32,22 36,28 28,26" fill="#5c4033"/>' +
        '<path d="M14,14 L20,12 L26,14" stroke="#5c4033" stroke-width="2" fill="none"/>' +
        '</svg>'
    },
    {
      id: 'railrunner',
      name: 'Railrunner',
      description: 'A speedy train-shaped critter in red and gold stripes',
      svg: '<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="4" y="14" width="32" height="16" rx="4" fill="#80000a"/>' +
        '<rect x="4" y="17" width="32" height="3" fill="#c9a227"/>' +
        '<rect x="4" y="23" width="32" height="3" fill="#c9a227"/>' +
        '<rect x="30" y="10" width="8" height="8" rx="2" fill="#80000a" stroke="#6b0008" stroke-width="1"/>' +
        '<circle cx="34" cy="13" r="1.5" fill="#fff"/>' +
        '<circle cx="34" cy="13" r="0.7" fill="#333"/>' +
        '<circle cx="10" cy="32" r="3" fill="#333" stroke="#666" stroke-width="1"/>' +
        '<circle cx="22" cy="32" r="3" fill="#333" stroke="#666" stroke-width="1"/>' +
        '<circle cx="32" cy="32" r="3" fill="#333" stroke="#666" stroke-width="1"/>' +
        '<circle cx="10" cy="32" r="1" fill="#999"/>' +
        '<circle cx="22" cy="32" r="1" fill="#999"/>' +
        '<circle cx="32" cy="32" r="1" fill="#999"/>' +
        '<rect x="2" y="18" width="4" height="6" rx="1" fill="#c9a227"/>' +
        '<line x1="36" y1="8" x2="36" y2="5" stroke="#888" stroke-width="1.5" stroke-linecap="round"/>' +
        '<ellipse cx="36" cy="4" rx="2" ry="1.5" fill="#ccc" opacity="0.6"/>' +
        '</svg>'
    },
    {
      id: 'tifoul',
      name: 'Tifoul',
      description: 'A swirling smoke creature in burgundy and gold',
      svg: '<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="20" cy="28" rx="10" ry="8" fill="#80000a" opacity="0.8"/>' +
        '<ellipse cx="16" cy="20" rx="6" ry="7" fill="#80000a" opacity="0.7"/>' +
        '<ellipse cx="26" cy="18" rx="5" ry="6" fill="#a00010" opacity="0.6"/>' +
        '<ellipse cx="20" cy="12" rx="7" ry="5" fill="#c9a227" opacity="0.5"/>' +
        '<ellipse cx="14" cy="10" rx="4" ry="4" fill="#c9a227" opacity="0.4"/>' +
        '<ellipse cx="27" cy="8" rx="3" ry="3" fill="#e0b830" opacity="0.3"/>' +
        '<circle cx="16" cy="24" r="2" fill="#fff"/>' +
        '<circle cx="24" cy="24" r="2" fill="#fff"/>' +
        '<circle cx="16" cy="24" r="1" fill="#333"/>' +
        '<circle cx="24" cy="24" r="1" fill="#333"/>' +
        '<path d="M17,29 Q20,31 23,29" stroke="#c9a227" stroke-width="1" fill="none" stroke-linecap="round"/>' +
        '<path d="M10,14 Q8,8 12,6" stroke="#c9a227" stroke-width="1.5" fill="none" opacity="0.5" stroke-linecap="round"/>' +
        '<path d="M28,12 Q32,6 28,4" stroke="#e0b830" stroke-width="1.5" fill="none" opacity="0.4" stroke-linecap="round"/>' +
        '</svg>'
    }
  ];

  // ─── localStorage helpers ──────────────────────────────────────────
  var STORAGE_KEY = 'atlutd-critters-caught';

  function getCaught() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch(e) { return []; }
  }

  function addCaught(id) {
    var caught = getCaught();
    if (caught.indexOf(id) === -1) {
      caught.push(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(caught));
    }
    return caught;
  }

  function isCaught(id) {
    return getCaught().indexOf(id) !== -1;
  }

  // ─── Inject CSS ────────────────────────────────────────────────────
  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.critter-badge{position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;' +
      'background:#80000a;color:#c9a227;border:2px solid #c9a227;display:flex;align-items:center;' +
      'justify-content:center;font-family:Oswald,sans-serif;font-size:14px;font-weight:700;cursor:pointer;' +
      'z-index:10001;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:transform 0.2s;}' +
      '.critter-badge:hover{transform:scale(1.1);}' +

      '.critter-tray{position:fixed;bottom:80px;right:20px;width:280px;background:#1a1a1a;border:1px solid #c9a227;' +
      'border-radius:12px;z-index:10002;box-shadow:0 4px 20px rgba(0,0,0,0.5);display:none;overflow:hidden;}' +
      '.critter-tray.critter-open{display:block;animation:critter-slideUp 0.25s ease-out;}' +

      '.critter-tray-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;' +
      'background:#80000a;color:#c9a227;font-family:Oswald,sans-serif;font-size:16px;font-weight:700;}' +
      '.critter-tray-close{background:none;border:none;color:#c9a227;font-size:20px;cursor:pointer;line-height:1;padding:0 4px;}' +
      '.critter-tray-close:hover{color:#fff;}' +

      '.critter-tray-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;}' +

      '.critter-slot{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;' +
      'border-radius:8px;background:#2a2a2a;text-align:center;}' +
      '.critter-slot svg{width:40px;height:40px;}' +
      '.critter-slot-name{font-family:Oswald,sans-serif;font-size:12px;color:#c9a227;font-weight:600;}' +
      '.critter-slot.critter-uncaught svg{filter:brightness(0) saturate(100%) opacity(0.3);}' +
      '.critter-slot.critter-uncaught .critter-slot-name{color:#666;}' +

      '.critter-congrats{padding:8px 16px 12px;text-align:center;font-family:Oswald,sans-serif;' +
      'font-size:13px;color:#c9a227;background:#2a2a2a;border-top:1px solid #333;}' +

      '.critter-spawn{position:fixed;z-index:10003;cursor:pointer;transition:opacity 0.3s;' +
      'animation:critter-bounceIn 0.4s ease-out;}' +
      '.critter-spawn svg{width:48px;height:48px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4));}' +
      '.critter-spawn:hover svg{transform:scale(1.15);transition:transform 0.15s;}' +
      '.critter-spawn.critter-caught-anim{animation:critter-catch 0.4s ease-out;}' +
      '.critter-spawn.critter-fadeout{opacity:0;pointer-events:none;}' +

      '.critter-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'background:#1a1a1a;border:1px solid #c9a227;border-radius:10px;padding:10px 18px;' +
      'display:flex;align-items:center;gap:10px;z-index:10004;box-shadow:0 4px 16px rgba(0,0,0,0.4);' +
      'animation:critter-slideUp 0.3s ease-out;font-family:Oswald,sans-serif;color:#fff;font-size:14px;}' +
      '.critter-toast svg{width:32px;height:32px;}' +
      '.critter-toast-already{color:#999;font-size:12px;}' +

      '@keyframes critter-bounceIn{0%{transform:scale(0);opacity:0;}60%{transform:scale(1.2);}100%{transform:scale(1);opacity:1;}}' +
      '@keyframes critter-catch{0%{transform:scale(1);}20%{transform:scale(1.3) rotate(-5deg);}' +
      '40%{transform:scale(1.3) rotate(5deg);}60%{transform:scale(1.3) rotate(-3deg);}' +
      '80%{transform:scale(0.9);}100%{transform:scale(0);opacity:0;}}' +
      '@keyframes critter-slideUp{0%{opacity:0;transform:translateY(20px) translateX(-50%);}100%{opacity:1;transform:translateY(0) translateX(-50%);}}' +

      '@media(max-width:768px){' +
        '.critter-tray{right:10px;left:10px;width:auto;bottom:74px;}' +
        '.critter-badge{bottom:14px;right:14px;width:42px;height:42px;font-size:13px;}' +
        '.critter-toast{bottom:70px;left:10px;right:10px;transform:none;justify-content:center;}' +
        '@keyframes critter-slideUp{0%{opacity:0;transform:translateY(20px);}100%{opacity:1;transform:translateY(0);}}' +
      '}';
    document.head.appendChild(style);
  }

  // ─── UI ────────────────────────────────────────────────────────────
  var badge, tray, trayGrid;

  function buildUI() {
    // Badge
    badge = document.createElement('div');
    badge.className = 'critter-badge';
    badge.setAttribute('aria-label', 'Critter Collection');
    badge.title = 'Critter Collection';
    updateBadge();
    badge.addEventListener('click', toggleTray);
    document.body.appendChild(badge);

    // Tray
    tray = document.createElement('div');
    tray.className = 'critter-tray';

    var header = document.createElement('div');
    header.className = 'critter-tray-header';
    header.innerHTML = '<span>Critter Collection</span>';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'critter-tray-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      tray.classList.remove('critter-open');
    });
    header.appendChild(closeBtn);
    tray.appendChild(header);

    trayGrid = document.createElement('div');
    trayGrid.className = 'critter-tray-grid';
    tray.appendChild(trayGrid);

    document.body.appendChild(tray);
    renderTray();
  }

  function updateBadge() {
    var count = getCaught().length;
    badge.textContent = count + '/6';
  }

  function renderTray() {
    var caught = getCaught();
    trayGrid.innerHTML = '';

    CRITTERS.forEach(function(c) {
      var slot = document.createElement('div');
      slot.className = 'critter-slot' + (caught.indexOf(c.id) === -1 ? ' critter-uncaught' : '');
      slot.innerHTML = c.svg + '<div class="critter-slot-name">' +
        (caught.indexOf(c.id) !== -1 ? c.name : '???') + '</div>';
      trayGrid.appendChild(slot);
    });

    // Congrats message
    var existing = tray.querySelector('.critter-congrats');
    if (existing) existing.remove();
    if (caught.length === 6) {
      var congrats = document.createElement('div');
      congrats.className = 'critter-congrats';
      congrats.textContent = 'You caught them all! True ATL supporter!';
      tray.appendChild(congrats);
    }
  }

  function toggleTray() {
    if (tray.classList.contains('critter-open')) {
      tray.classList.remove('critter-open');
    } else {
      renderTray();
      tray.classList.add('critter-open');
    }
  }

  // ─── Spawning ──────────────────────────────────────────────────────
  function spawnCritter() {
    var critter = CRITTERS[Math.floor(Math.random() * CRITTERS.length)];
    var alreadyCaught = isCaught(critter.id);

    var el = document.createElement('div');
    el.className = 'critter-spawn';

    // Random position keeping critter fully on screen
    var margin = 60;
    var x = margin + Math.random() * (window.innerWidth - margin * 2);
    var y = margin + Math.random() * (window.innerHeight - margin * 2);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML = critter.svg;

    document.body.appendChild(el);

    // Click to catch
    el.addEventListener('click', function() {
      el.classList.add('critter-caught-anim');

      if (!alreadyCaught) {
        addCaught(critter.id);
        updateBadge();
        if (tray.classList.contains('critter-open')) renderTray();
      }

      showToast(critter, alreadyCaught);

      setTimeout(function() {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 400);
    });

    // Fade out after 5 seconds if not clicked
    setTimeout(function() {
      if (el.parentNode && !el.classList.contains('critter-caught-anim')) {
        el.classList.add('critter-fadeout');
        setTimeout(function() {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 300);
      }
    }, 5000);

    // Schedule next
    scheduleSpawn();
  }

  function showToast(critter, alreadyCaught) {
    // Remove any existing toast
    var existing = document.querySelector('.critter-toast');
    if (existing) existing.parentNode.removeChild(existing);

    var toast = document.createElement('div');
    toast.className = 'critter-toast';
    if (alreadyCaught) {
      toast.innerHTML = critter.svg +
        '<div><div>It\'s ' + critter.name + '!</div>' +
        '<div class="critter-toast-already">Already in your collection</div></div>';
    } else {
      toast.innerHTML = critter.svg +
        '<div>You caught <strong style="color:#c9a227;">' + critter.name + '</strong>!</div>';
    }
    document.body.appendChild(toast);

    setTimeout(function() {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }
    }, 3000);
  }

  // ─── Scheduling ────────────────────────────────────────────────────
  function scheduleSpawn() {
    var delay = 30000 + Math.random() * 30000; // 30-60 seconds
    setTimeout(spawnCritter, delay);
  }

  // ─── Init ──────────────────────────────────────────────────────────
  injectStyles();
  buildUI();
  scheduleSpawn();
})();
