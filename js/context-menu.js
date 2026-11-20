/* Pocu Music — контекстное меню для треков (v2.0) */
window.PocuContextMenu = (() => {
  let $menu, $overlay, $submenu;
  let $drawerOverlay, $drawer, $drawerTitle, $drawerBody;
  let $reportSheet, $reportBody;
  let activeTrack = null;
  let longPressTimer = null;
  let initialized = false;
  let suppressTileClick = false;

  const ICONS = {
    pulse:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3l2-7 4 14 2-7h7"/></svg>',
    next:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14l9-7z" fill="currentColor"/><path d="M16 5v14"/></svg>',
    queue:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12"/><path d="M4 12h12"/><path d="M4 18h8"/><path d="M20 13v5"/><path d="M17 16h6"/></svg>',
    playlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h10"/><circle cx="18" cy="16" r="3"/><path d="M21 16V8l-3 1"/></svg>',
    lyrics:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16"/><path d="M4 10h16"/><path d="M4 15h10"/><path d="M4 20h7"/></svg>',
    info:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="8" r=".9" fill="currentColor" stroke="none"/></svg>',
    artist:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    track:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
    share:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>',
    report:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20z"/><path d="M12 10v5"/><circle cx="12" cy="18.5" r=".9" fill="currentColor" stroke="none"/></svg>'
  };

  function init() {
    if (initialized) return;
    initialized = true;

    /* === Меню + подменю === */
    if (!document.getElementById('contextMenu')) {
      $overlay = document.createElement('div');
      $overlay.className = 'context-overlay';
      $overlay.id = 'contextOverlay';

      $menu = document.createElement('div');
      $menu.className = 'context-menu';
      $menu.id = 'contextMenu';
      $menu.setAttribute('role', 'menu');

      $submenu = document.createElement('div');
      $submenu.className = 'context-submenu';
      $submenu.id = 'contextSubmenu';
      $submenu.setAttribute('role', 'menu');

      $overlay.append($menu, $submenu);
      document.body.appendChild($overlay);

      $overlay.addEventListener('click', (e) => {
        if (e.target === $overlay) closeAll();
      });
    } else {
      $overlay = document.getElementById('contextOverlay');
      $menu    = document.getElementById('contextMenu');
      $submenu = document.getElementById('contextSubmenu');
    }

    /* === Drawer (О треке / Текст песни) === */
    if (!document.getElementById('trackDrawerOverlay')) {
      $drawerOverlay = document.createElement('div');
      $drawerOverlay.className = 'track-drawer-overlay';
      $drawerOverlay.id = 'trackDrawerOverlay';

      $drawer = document.createElement('div');
      $drawer.className = 'track-drawer';
      $drawer.innerHTML = `
        <div class="track-drawer-header">
          <div class="track-drawer-title" id="trackDrawerTitle">—</div>
          <button class="track-drawer-close" id="trackDrawerClose" aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="track-drawer-body" id="trackDrawerBody"></div>
      `;
      $drawerOverlay.appendChild($drawer);
      document.body.appendChild($drawerOverlay);

      $drawerTitle = $drawer.querySelector('#trackDrawerTitle');
      $drawerBody  = $drawer.querySelector('#trackDrawerBody');

      $drawerOverlay.addEventListener('click', (e) => {
        if (e.target === $drawerOverlay) closeDrawer();
      });
      $drawer.querySelector('#trackDrawerClose').addEventListener('click', closeDrawer);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if ($drawerOverlay?.classList.contains('open')) { closeDrawer(); return; }
          if ($reportSheet?.classList.contains('open'))   { closeReport(); return; }
          if ($overlay?.classList.contains('open'))       { closeAll(); }
        }
      });
    } else {
      $drawerOverlay = document.getElementById('trackDrawerOverlay');
      $drawer        = $drawerOverlay.querySelector('.track-drawer');
      $drawerTitle   = $drawerOverlay.querySelector('#trackDrawerTitle');
      $drawerBody    = $drawerOverlay.querySelector('#trackDrawerBody');
    }

    /* === Report sheet === */
    if (!document.getElementById('reportSheet')) {
      $reportSheet = document.createElement('div');
      $reportSheet.className = 'sheet-overlay';
      $reportSheet.id = 'reportSheet';
      $reportSheet.innerHTML = `
        <div class="sheet-panel">
          <div class="sheet-header"><h2>Сообщить о проблеме</h2></div>
          <div class="sheet-body" id="reportBody"></div>
          <div class="sheet-actions">
            <button class="btn btn-secondary" id="reportCancelBtn">Отмена</button>
          </div>
        </div>
      `;
      document.body.appendChild($reportSheet);
      $reportBody = $reportSheet.querySelector('#reportBody');

      $reportSheet.addEventListener('click', (e) => {
        if (e.target === $reportSheet) closeReport();
      });
      $reportSheet.querySelector('#reportCancelBtn').addEventListener('click', closeReport);
    } else {
      $reportSheet = document.getElementById('reportSheet');
      $reportBody  = $reportSheet.querySelector('#reportBody');
    }

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointerup',   onPointerUp,   { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('contextmenu', onContextMenu);
  }

  /* ---------- Long-press / right-click ---------- */
  function onPointerDown(e) {
    if (e.pointerType === 'mouse') return;

    const trackEl = e.target.closest('.track[data-id]');
    if (trackEl) {
      if (e.target.closest('button, .track-heart, .track-play, .track-remove')) return;
      const trackId = trackEl.dataset.id;
      const track = window.PocuLibrary.get(trackId);
      if (!track) return;
      activeTrack = track;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        suppressTileClick = true;
        setTimeout(() => suppressTileClick = false, 400);
        open(track, e.clientX, e.clientY);
      }, 500);
      return;
    }

    const tileEl = e.target.closest('.home-tile[data-id], .recent-tile[data-id]');
    if (!tileEl) return;
    if (e.target.closest('button, .tile-menu')) return;

    const trackId = tileEl.dataset.id;
    const track = window.PocuLibrary.get(trackId);
    if (!track) return;
    activeTrack = track;

    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      suppressTileClick = true;
      setTimeout(() => suppressTileClick = false, 400);
      open(track, e.clientX, e.clientY);
    }, 500);
  }

  function onPointerUp() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }
  function onPointerMove(e) {
    if (longPressTimer && (Math.abs(e.movementX) > 5 || Math.abs(e.movementY) > 5)) {
      clearTimeout(longPressTimer); longPressTimer = null;
    }
  }
  function onContextMenu(e) {
    const trackEl = e.target.closest('.track[data-id], .home-tile[data-id], .recent-tile[data-id]');
    if (!trackEl) return;
    if (e.target.closest('button, .tile-menu')) return;
    e.preventDefault();
    const track = window.PocuLibrary.get(trackEl.dataset.id);
    if (!track) return;
    open(track, e.clientX, e.clientY);
  }

  /* ---------- Open / close ---------- */
  function closeAll() {
    closeSubmenu();
    close();
  }
  function close() {
    $overlay?.classList.remove('open');
    $submenu?.classList.remove('open');
    activeTrack = null;
  }
  function closeSubmenu() {
    $submenu?.classList.remove('open');
  }
  function closeDrawer() {
    $drawerOverlay?.classList.remove('open');
  }
  function closeReport() {
    $reportSheet?.classList.remove('open');
  }

  function open(track, x, y) {
    activeTrack = track;
    closeSubmenu();

    $menu.innerHTML = `
      <button class="context-item" data-action="pulse">
        <span class="context-icon">${ICONS.pulse}</span>
        <span class="context-label">Мой пульс по треку</span>
      </button>
      <div class="context-divider"></div>
      <button class="context-item" data-action="play-next">
        <span class="context-icon">${ICONS.next}</span>
        <span class="context-label">Поставить следующим</span>
      </button>
      <button class="context-item" data-action="play-end">
        <span class="context-icon">${ICONS.queue}</span>
        <span class="context-label">Поставить в конец очереди</span>
      </button>
      <div class="context-divider"></div>
      <button class="context-item" data-action="add-playlist">
        <span class="context-icon">${ICONS.playlist}</span>
        <span class="context-label">Добавить в плейлист</span>
        <span class="context-chevron">›</span>
      </button>
      <div class="context-divider"></div>
      <button class="context-item" data-action="lyrics">
        <span class="context-icon">${ICONS.lyrics}</span>
        <span class="context-label">Показать текст песни</span>
      </button>
      <button class="context-item" data-action="info">
        <span class="context-icon">${ICONS.info}</span>
        <span class="context-label">О треке</span>
      </button>
      <div class="context-divider"></div>
      <button class="context-item" data-action="goto-artist">
        <span class="context-icon">${ICONS.artist}</span>
        <span class="context-label">Перейти к исполнителю</span>
      </button>
      <button class="context-item" data-action="goto-track">
        <span class="context-icon">${ICONS.track}</span>
        <span class="context-label">Перейти к треку</span>
      </button>
      <div class="context-divider"></div>
      <button class="context-item" data-action="share">
        <span class="context-icon">${ICONS.share}</span>
        <span class="context-label">Поделиться</span>
      </button>
      <div class="context-divider"></div>
      <button class="context-item" data-action="report">
        <span class="context-icon">${ICONS.report}</span>
        <span class="context-label">Сообщить о проблеме</span>
      </button>
    `;

    $menu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, track, btn));
    });

    $overlay.classList.add('open');
    positionMenu(x, y);
  }

  function positionMenu(x, y) {
    const m = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    $menu.style.left = '0px';
    $menu.style.top = '0px';
    $menu.style.maxHeight = '';
    $menu.style.overflowY = '';

    const r1 = $menu.getBoundingClientRect();
    const maxH = vh - 2 * m;
    if (r1.height > maxH) {
      $menu.style.maxHeight = maxH + 'px';
      $menu.style.overflowY = 'auto';
    }

    const rect = $menu.getBoundingClientRect();

    let left = x;
    if (left + rect.width > vw - m) {
      left = x - rect.width;
      if (left < m) left = m;
    }

    let top = y;
    if (top + rect.height > vh - m) {
      top = y - rect.height;
      if (top < m) top = m;
    }

    $menu.style.left = left + 'px';
    $menu.style.top  = top + 'px';
  }

  function handleAction(action, track, btn) {
    if (action === 'pulse') {
      window.PocuPulse?.startFromTrack?.(track);
      close();
    } else if (action === 'play-next') {
      window.PocuPlayer?.insertNext?.(track);
      close();
    } else if (action === 'play-end') {
      window.PocuPlayer?.appendTrack?.(track);
      close();
    } else if (action === 'add-playlist') {
      openPlaylistSubmenu(btn.getBoundingClientRect(), track);
    } else if (action === 'lyrics') {
      close(); openDrawer('lyrics', track);
    } else if (action === 'info') {
      close(); openDrawer('info', track);
    } else if (action === 'goto-artist') {
      close();
      const parts = window.PocuArtists.splitArtists(track.artist);
      const name = parts[0] || track.artist;
      if (name) window.PocuArtistUI?.openArtist?.(name);
    } else if (action === 'goto-track') {
      close();
      window.PocuTrackUI?.open?.(track.id);
    } else if (action === 'share') {
      close();
      const url = window.PocuRouter?.build?.('track', track.id) || window.location.href;
      const title = track.title;
      const text  = `${track.artist} — ${track.title}`;
      if (window.PocuShare?.share) {
        window.PocuShare.share(url, title, text);
      } else if (navigator.share) {
        navigator.share({ title, text, url }).catch(() => {});
      }
    } else if (action === 'report') {
      close(); openReport(track);
    }
  }

  /* ---------- Submenu «Добавить в плейлист» ---------- */
  function openPlaylistSubmenu(anchorRect, track) {
    const playlists = window.PocuStore.playlists.all();
    const m = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    $submenu.innerHTML = `
      <div class="context-subheader">Добавить в плейлист</div>
      ${playlists.length === 0 ? '<div class="context-empty">Нет плейлистов</div>' : ''}
      ${playlists.map(pl => `
        <button class="context-item" data-playlist-id="${pl.id}">
          <span class="context-label">${escapeHtml(pl.name)}</span>
          <span class="context-count">${pl.trackIds.length}</span>
        </button>
      `).join('')}
      <div class="context-divider"></div>
      <button class="context-item" data-action="create-new">
        <span class="context-label">+ Создать новый плейлист</span>
      </button>
    `;

    $submenu.style.left = '0px';
    $submenu.style.top  = '0px';
    $submenu.style.maxHeight = '';
    $submenu.style.overflowY = '';

    const r1 = $submenu.getBoundingClientRect();
    const maxH = vh - 2 * m;
    if (r1.height > maxH) {
      $submenu.style.maxHeight = maxH + 'px';
      $submenu.style.overflowY = 'auto';
    }
    const rect = $submenu.getBoundingClientRect();
    const menuRect = $menu.getBoundingClientRect();

    let left = menuRect.right + 4;
    if (left + rect.width > vw - m) {
      left = menuRect.left - rect.width - 4;
      if (left < m) left = m;
    }
    let top = anchorRect.top;
    if (top + rect.height > vh - m) {
      top = vh - rect.height - m;
      if (top < m) top = m;
    }
    $submenu.style.left = left + 'px';
    $submenu.style.top  = top + 'px';
    $submenu.classList.add('open');

    $submenu.querySelectorAll('[data-playlist-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const plId = btn.dataset.playlistId;
        if (!track) return;
        window.PocuStore.playlists.addTrack(plId, track.id);
        window.PocuSupabase?.syncPlaylistTrackAdd?.(plId, track.id);
        showToast('Добавлено в плейлист');
        closeAll();
      });
    });

    $submenu.querySelector('[data-action="create-new"]')?.addEventListener('click', () => {
      if (!track) { closeAll(); return; }

      const trackName = (track.title || 'Новый плейлист').trim();
      const existing = window.PocuStore.playlists.all().find(p => p.name === trackName);

      let pl;
      if (existing) {
        // Плейлист с таким названием уже есть — добавляем трек в него
        pl = existing;
        if (!pl.trackIds.includes(track.id)) {
          window.PocuStore.playlists.addTrack(pl.id, track.id);
          window.PocuSupabase?.syncPlaylistTrackAdd?.(pl.id, track.id);
        }
      } else {
        // Создаём новый плейлист с названием трека и сразу кладём туда трек
        pl = window.PocuStore.playlists.create(trackName);
        window.PocuSupabase?.syncPlaylistCreate?.(pl);
        window.PocuStore.playlists.addTrack(pl.id, track.id);
        window.PocuSupabase?.syncPlaylistTrackAdd?.(pl.id, track.id);
      }

      closeAll();

      // Даём меню закрыться и открываем страницу плейлиста
      requestAnimationFrame(() => {
        window.PocuPlaylistsUI?.openPlaylistScreen?.(pl.id);
      });
    });
  }

  /* ---------- Drawer (О треке / Текст песни) ---------- */
  function openDrawer(type, track) {
    if (type === 'info') {
      $drawerTitle.textContent = 'О треке';
      const artistsStr = (window.PocuArtists?.splitArtists?.(track.artist) || [track.artist]).join(', ');
      $drawerBody.innerHTML = `
        <div class="track-drawer-track">
          <div class="track-drawer-track-title">${escapeHtml(track.title || '—')}</div>
          <div class="track-drawer-track-artist">${escapeHtml(track.artist || '—')}</div>
        </div>
        <div class="track-drawer-info-row"><span class="label">Исполнитель</span><span class="value">${escapeHtml(artistsStr || '—')}</span></div>
        <div class="track-drawer-info-row"><span class="label">Автор музыки</span><span class="value">${escapeHtml(track.musicBy || '—')}</span></div>
        <div class="track-drawer-info-row"><span class="label">Автор текста</span><span class="value">${escapeHtml(track.lyricsBy || '—')}</span></div>
        <div class="track-drawer-info-row"><span class="label">Лейбл</span><span class="value">${escapeHtml(track.label || '—')}</span></div>
        <div class="track-drawer-info-row"><span class="label">Источник фонограммы</span><span class="value">${escapeHtml(track.phonogramSource || '—')}</span></div>
      `;
    } else if (type === 'lyrics') {
      $drawerTitle.textContent = 'Текст песни';
      const lyrics = String(track.lyrics || '').trim();
      $drawerBody.innerHTML = `
        <div class="track-drawer-track">
          <div class="track-drawer-track-title">${escapeHtml(track.title || '—')}</div>
          <div class="track-drawer-track-artist">${escapeHtml(track.artist || '—')}</div>
        </div>
        ${lyrics
          ? `<div class="track-drawer-lyrics">${escapeHtml(lyrics)}</div>`
          : `<div class="track-drawer-empty">Текст пока не добавлен</div>`}
      `;
    }
    $drawerOverlay.classList.add('open');
    $drawerBody.scrollTop = 0;
  }

  /* ---------- Report sheet ---------- */
  function openReport(track) {
    const problems = [
      'Не играет трек',
      'Неверная обложка',
      'Неверное название или исполнитель',
      'Нецензурная лексика',
      'Нарушение авторских прав',
      'Другое'
    ];
    $reportBody.innerHTML = problems.map(p =>
      `<button class="report-option" data-problem="${escapeHtml(p)}">${escapeHtml(p)}</button>`
    ).join('');

    $reportBody.querySelectorAll('.report-option').forEach(btn => {
      btn.addEventListener('click', () => {
        closeReport();
        showToast('Спасибо, жалоба принята');
      });
    });

    $reportSheet.classList.add('open');
  }

  /* ---------- Helpers ---------- */
  function showToast(text) {
    let toast = document.getElementById('pocuToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pocuToast';
      toast.style.cssText = `
        position: fixed;
        left: 50%;
        bottom: calc(140px + env(safe-area-inset-bottom));
        transform: translateX(-50%) translateY(8px);
        padding: 10px 20px;
        border-radius: 14px;
        background: rgba(30,30,38,.95);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid rgba(255,255,255,.12);
        color: #fff;
        font-size: 13px;
        font-weight: 650;
        z-index: 400;
        opacity: 0;
        pointer-events: none;
        transition: opacity .2s ease, transform .25s cubic-bezier(.22,1.15,.36,1);
        white-space: nowrap;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(8px)';
    }, 2000);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  return {
    init,
    close: closeAll,
    openAt: (track, x, y) => open(track, x, y),
    isSuppressingClick: () => suppressTileClick
  };
})();