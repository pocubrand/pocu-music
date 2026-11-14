/* Pocu Music — точка входа: таб-бар, роутер, SW, инициализация */
(() => {
  'use strict';

  const SIDEBAR_KEY = 'pocu.sidebar.collapsed';
  try { if (localStorage.getItem(SIDEBAR_KEY) === '1') document.body.classList.add('sidebar-collapsed'); } catch {}

  const sidebarToggle = document.getElementById('sidebarToggle');
  let sidebarTimer = null;
  sidebarToggle?.addEventListener('click', () => {
    document.body.classList.add('sidebar-transitioning');
    document.body.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem(SIDEBAR_KEY, document.body.classList.contains('sidebar-collapsed') ? '1' : '0'); } catch {}
    clearTimeout(sidebarTimer);
    sidebarTimer = setTimeout(() => document.body.classList.remove('sidebar-transitioning'), 300);
  });

  const tabbar  = document.getElementById('tabbar');
  const bubble  = document.getElementById('bubble');
  const main    = document.getElementById('main');
  const items   = [...tabbar.querySelectorAll('.tab-item[data-tab]')];
  const screens = [...document.querySelectorAll('.screen')];

  const BUBBLE = 46;
  const LENS   = 74;
  const tabNames = items.map(i => i.dataset.tab);

  let centers = [], activeIndex = 0, bubbleX = 0, drag = null;

  function measure() {
    items.forEach(it => it.style.transform = '');
    const barRect = tabbar.getBoundingClientRect();
    centers = items.map(it => {
      const r = it.getBoundingClientRect();
      return r.left - barRect.left + r.width / 2;
    });
    bubbleX = centers[activeIndex] ?? 0;
  }

  function paintBubble(animate = true, scale = 1) {
    if (!bubble) return;
    if (!animate) bubble.classList.add('no-anim');
    bubble.style.transform = `translate3d(${bubbleX - BUBBLE / 2}px, -50%, 0) scale(${scale})`;
    updateLens(bubbleX);
    if (!animate) requestAnimationFrame(() => requestAnimationFrame(() => bubble.classList.remove('no-anim')));
  }

  function updateLens(x) {
    for (let i = 0; i < items.length; i++) {
      const d = Math.abs(x - centers[i]);
      const t = Math.max(0, 1 - d / LENS);
      items[i].style.transform = `translateY(${-3.2 * Math.pow(t, 2)}px) scale(${1 + 0.42 * Math.pow(t, 1.7)})`;
      items[i].style.opacity   = (0.6 + 0.4 * Math.pow(t, .75)).toFixed(3);
    }
  }

  function nearestIndex(x) {
    let best = 0, bestD = Infinity;
    centers.forEach((c, i) => { const d = Math.abs(c - x); if (d < bestD) { bestD = d; best = i; } });
    return best;
  }

  function selectTab(index) {
    if (index < 0 || index >= items.length) return;

    if (window.PocuPlaylistsUI) {
      const pl = document.getElementById('playlistScreen');
      if (pl?.classList.contains('open')) window.PocuPlaylistsUI.closePlaylistScreen?.();
    }
    if (window.PocuArtistUI) {
      const a = document.getElementById('artistScreen');
      if (a?.classList.contains('open')) window.PocuArtistUI.closeArtist();
    }
    if (window.PocuAlbumUI) {
      const al = document.getElementById('albumScreen');
      if (al?.classList.contains('open')) window.PocuAlbumUI.closeAlbum();
    }
    if (window.PocuGenreUI) {
      const g = document.getElementById('genreScreen');
      if (g?.classList.contains('open')) window.PocuGenreUI.close();
    }
    const hs = document.getElementById('historyScreen');
    if (hs?.classList.contains('open')) {
      hs.classList.remove('open');
      hs.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('playlist-open');
    }
    if (window.PocuTrackUI) {
      const tr = document.getElementById('trackScreen');
      if (tr?.classList.contains('open')) window.PocuTrackUI.close();
    }

    activeIndex = index;
    bubbleX = centers[index];
    paintBubble(true);
    updateLens(bubbleX);
    items.forEach((it, i) => it.classList.toggle('active', i === index));
    showScreen(tabNames[index]);
    main?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showScreen(name) {
    screens.forEach(s => {
      const on = s.dataset.screen === name;
      s.classList.toggle('active', on);
      if (!on) return;
      [...s.children].forEach((el, i) => {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
        el.style.animationDelay = `${Math.min(i * 55, 420)}ms`;
      });
    });
  }

  tabbar.addEventListener('pointerdown', e => {
    if (drag) return;
    if (bubble.offsetParent === null) return;
    if (!e.target.closest('.tab-item[data-tab]')) return;
    drag = { id: e.pointerId, startX: e.clientX, startBubble: bubbleX, moved: false };
    tabbar.setPointerCapture(e.pointerId);
    tabbar.classList.add('dragging');
    bubble.classList.add('lifted');
  });

  tabbar.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) > 4) drag.moved = true;
    const min = centers[0], max = centers[centers.length - 1];
    const x = Math.max(min, Math.min(max, drag.startBubble + dx));
    bubbleX = x;
    bubble.style.transform = `translate3d(${x - BUBBLE / 2}px, -50%, 0) scale(1.06)`;
    updateLens(x);
  });

  let suppressClick = false;
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    tabbar.classList.remove('dragging');
    bubble.classList.remove('lifted');
    if (moved) {
      const index = nearestIndex(bubbleX);
      bubbleX = centers[index];
      paintBubble(true);
      updateLens(bubbleX);
      items.forEach((it, i) => it.classList.toggle('active', i === index));
      showScreen(tabNames[index]);
      activeIndex = index;
      suppressClick = true;
      setTimeout(() => suppressClick = false, 300);
    } else {
      const index = nearestIndex(bubbleX);
      bubbleX = centers[index];
      paintBubble(true);
      updateLens(bubbleX);
    }
  }
  tabbar.addEventListener('pointerup', endDrag);
  tabbar.addEventListener('pointercancel', endDrag);

  tabbar.addEventListener('click', e => {
    if (suppressClick) return;
    if (e.target.closest('.sidebar-toggle')) return;
    if (e.target.closest('.tab-item-settings')) return;
    const item = e.target.closest('.tab-item[data-tab]');
    if (!item) return;
    const index = items.indexOf(item);
    if (index === -1) return;
    bubbleX = centers[index];
    selectTab(index);
  });

  requestAnimationFrame(() => {
    measure();
    const homeIdx = tabNames.indexOf('home');
    if (homeIdx >= 0) {
      activeIndex = homeIdx;
      bubbleX = centers[homeIdx];
      items.forEach((it, i) => it.classList.toggle('active', i === homeIdx));
    } else {
      bubbleX = centers[0];
      items[0]?.classList.add('active');
    }
    paintBubble(false);
    updateLens(bubbleX);
  });

  window.addEventListener('resize', () => { measure(); paintBubble(false); });
  window.addEventListener('orientationchange', () => setTimeout(() => { measure(); paintBubble(false); }, 320));
  if (document.fonts?.ready) document.fonts.ready.then(() => { measure(); paintBubble(false); });

  function safeInit(label, fn) {
    try {
      if (typeof fn !== 'function') { console.warn(`[init] ${label}: не функция`); return; }
      fn();
    } catch (e) { console.error(`[init] ${label} упал:`, e); }
  }

  /* ========== Deep-link router (hash-based) ==========
     Форматы ссылок:
       #track/<id>
       #playlist/<id>
       #album/<artist>/<album>
       #artist/<id>
     Router автоматически открывает нужный экран при загрузке страницы
     с таким хешем и при ручной смене хеша в адресной строке. */
  window.PocuRouter = (() => {
    function parseHash() {
      const raw = (location.hash || '').replace(/^#\/?/, '');
      if (!raw) return null;
      const parts = raw.split('/').map(p => {
        try { return decodeURIComponent(p); } catch { return p; }
      });
      if (!parts[0]) return null;
      return { type: parts[0], params: parts.slice(1) };
    }

    function build(type, ...parts) {
      const base = location.origin + location.pathname;
      const segs = [type, ...parts.map(p => encodeURIComponent(String(p ?? '')))];
      return `${base}#${segs.join('/')}`;
    }

    function dispatch() {
      const route = parseHash();
      if (!route) return;
      const { type, params } = route;
      try {
        if (type === 'track' && params[0]) {
          window.PocuTrackUI?.open?.(params[0]);
        } else if (type === 'playlist' && params[0]) {
          window.PocuPlaylistsUI?.openPlaylistScreen?.(params[0]);
        } else if (type === 'album' && params[0] && params[1]) {
          window.PocuAlbumUI?.open?.(params[0], params[1]);
        } else if (type === 'artist' && params[0]) {
          window.PocuArtistUI?.openArtist?.(params[0]);
        }
      } catch (e) { console.warn('[router] dispatch failed', e); }
    }

    function setHash(type, ...parts) {
      const h = '#' + [type, ...parts.map(p => encodeURIComponent(String(p ?? '')))].join('/');
      if (location.hash === h) return;
      try { history.replaceState(null, '', location.pathname + location.search + h); } catch {}
    }

    function clearHash() {
      if (!location.hash) return;
      try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    }

    function init() {
      window.addEventListener('hashchange', dispatch);
    }

    return { init, dispatch, build, setHash, clearHash };
  })();

  /* ========== Хелпер шаринга ========== */
  window.PocuShare = (() => {
    function toast(text) {
      const el = document.createElement('div');
      el.className = 'pulse-toast';
      el.textContent = text;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 1800);
    }

    async function share(url, title, text) {
      try {
        if (navigator.share) {
          await navigator.share({ title, text, url });
          return;
        }
      } catch (e) {
        if (e?.name === 'AbortError') return;   // пользователь отменил системный шит — не фолбэчим
      }
      try {
        await navigator.clipboard.writeText(url);
        toast('Ссылка скопирована');
      } catch {
        try { window.prompt('Скопируйте ссылку:', url); } catch {}
      }
    }

    return { share, toast };
  })();

  (async () => {
    try { await window.PocuLibrary?.load?.(); } catch (e) { console.error('[init] Library.load:', e); }
    try { await window.PocuArtists?.load?.(); } catch (e) { console.error('[init] Artists.load:', e); }

    safeInit('PocuAuthUI.init',     () => window.PocuAuthUI?.init?.());
    safeInit('PocuSupabase.init',   () => window.PocuSupabase?.init?.());
    safeInit('PocuStore.load',      () => window.PocuStore?.load?.());
    safeInit('PocuPulse.init',      () => window.PocuPulse?.init?.());
    safeInit('PocuSearch.init',     () => window.PocuSearch?.init?.());
    safeInit('PocuUI.init',         () => window.PocuUI?.init?.());
    safeInit('PocuFavoritesUI.init',() => window.PocuFavoritesUI?.init?.());
    safeInit('PocuPlaylistsUI.init',() => window.PocuPlaylistsUI?.init?.());
    safeInit('PocuArtistUI.init',   () => window.PocuArtistUI?.init?.());
    safeInit('PocuAlbumUI.init',    () => window.PocuAlbumUI?.init?.());
    safeInit('PocuGenreUI.init',    () => window.PocuGenreUI?.init?.());
    safeInit('PocuTrackUI.init',    () => window.PocuTrackUI?.init?.());
    safeInit('PocuContextMenu.init',() => window.PocuContextMenu?.init?.());
    safeInit('PocuHomeUI.init',     () => window.PocuHomeUI?.init?.());
    safeInit('PocuChartsUI.init',   () => window.PocuChartsUI?.init?.());
    safeInit('PocuProfileUI.init',  () => window.PocuProfileUI?.init?.());
    safeInit('PocuSettingsUI.init', () => window.PocuSettingsUI?.init?.());
    safeInit('PocuEquilizerUI.init',  () => window.PocuEquilizerUI?.init?.());
    safeInit('PocuPreferencesUI.init', () => window.PocuPreferencesUI?.init?.());

    /* Deep-link: после того как все UI готовы, диспатчим хеш из URL */
    try { window.PocuRouter?.init?.(); } catch (e) { console.warn('[router] init', e); }
    setTimeout(() => { try { window.PocuRouter?.dispatch?.(); } catch (e) { console.warn('[router] dispatch', e); } }, 0);
  })();

  function setupEdgeSwipe() {
    const overlays = [
      { el: document.getElementById('playlistScreen'), close: () => window.PocuPlaylistsUI?.closePlaylistScreen() },
      { el: document.getElementById('artistScreen'),   close: () => window.PocuArtistUI?.closeArtist() },
      { el: document.getElementById('albumScreen'),    close: () => window.PocuAlbumUI?.closeAlbum() },
      { el: document.getElementById('genreScreen'),    close: () => window.PocuGenreUI?.close() },
      { el: document.getElementById('historyScreen'),  close: () => {
          const scr = document.getElementById('historyScreen');
          scr?.classList.remove('open');
          scr?.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('playlist-open');
        }
      },
      { el: document.getElementById('trackScreen'), close: () => window.PocuTrackUI?.close?.() }
    ];

    overlays.forEach(({ el, close }) => {
      if (!el) return;
      let startX = 0, startY = 0, currentX = 0, isSwiping = false, pointerId = null;
      el.addEventListener('pointerdown', e => {
        if (!el.classList.contains('open')) return;
        if (e.clientX > 40) return;
        if (e.target.closest('button, input, .btn, .track, .back-btn')) return;
        pointerId = e.pointerId; startX = e.clientX; startY = e.clientY; currentX = 0; isSwiping = false;
      });
      el.addEventListener('pointermove', e => {
        if (e.pointerId !== pointerId) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!isSwiping) {
          if (Math.abs(dx) > Math.abs(dy) && dx > 5) {
            isSwiping = true; el.style.transition = 'none';
            try { el.setPointerCapture(e.pointerId); } catch {}
          }
        }
        if (isSwiping) {
          currentX = Math.max(0, dx);
          el.style.transform = `translateX(${currentX}px)`;
          el.style.opacity = String(Math.max(0.5, 1 - currentX / (window.innerWidth * 2)));
        }
      });
      const endSwipe = e => {
        if (e.pointerId !== pointerId) return;
        if (isSwiping) {
          el.style.transition = ''; el.style.transform = ''; el.style.opacity = '';
          if (currentX > window.innerWidth * 0.3) close();
        }
        pointerId = null; isSwiping = false;
      };
      el.addEventListener('pointerup', endSwipe);
      el.addEventListener('pointercancel', endSwipe);
    });
  }
  requestAnimationFrame(setupEdgeSwipe);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.warn('[sw] register', err));
    });
  }
})();