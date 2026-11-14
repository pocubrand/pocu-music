/* Pocu Music — контекстное меню для треков */
window.PocuContextMenu = (() => {
  let $menu, $overlay;
  let activeTrack = null;
  let longPressTimer = null;
  let initialized = false;
  let suppressTileClick = false;

  function init() {
    if (initialized) return;
    initialized = true;

    if (!document.getElementById('contextMenu')) {
      $overlay = document.createElement('div');
      $overlay.className = 'context-overlay';
      $overlay.id = 'contextOverlay';

      $menu = document.createElement('div');
      $menu.className = 'context-menu';
      $menu.id = 'contextMenu';
      $menu.setAttribute('role', 'menu');

      $overlay.appendChild($menu);
      document.body.appendChild($overlay);

      $overlay.addEventListener('click', (e) => {
        if (e.target === $overlay) close();
      });
    } else {
      $overlay = document.getElementById('contextOverlay');
      $menu = document.getElementById('contextMenu');
    }

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointerup',   onPointerUp,   { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('contextmenu', onContextMenu);
  }

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
        activeTrack = null;
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
      activeTrack = null;
    }, 500);
  }

  function onPointerUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function onPointerMove(e) {
    if (longPressTimer && (Math.abs(e.movementX) > 5 || Math.abs(e.movementY) > 5)) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function onContextMenu(e) {
    const trackEl = e.target.closest('.track[data-id], .home-tile[data-id], .recent-tile[data-id]');
    if (!trackEl) return;
    if (e.target.closest('button, .tile-menu')) return;
    e.preventDefault();

    const trackId = trackEl.dataset.id;
    const track = window.PocuLibrary.get(trackId);
    if (!track) return;

    open(track, e.clientX, e.clientY);
  }

  function open(track, x, y) {
    activeTrack = track;

    const isFav = window.PocuStore.favorites.has(track.id);
    const isFavAlbum  = track.album && window.PocuStore.favoriteAlbums.has(track.artist, track.album);
    const isFavArtist = track.artistId && window.PocuStore.favoriteArtists.has(track.artistId);
    const playlists = window.PocuStore.playlists.all();

    $menu.innerHTML = `
      <div class="context-header">
        <div class="context-title">${escapeHtml(track.title)}</div>
        <div class="context-artist">${escapeHtml(track.artist)}</div>
      </div>
      <div class="context-divider"></div>
      <button class="context-item" data-action="play-next">
        <span>Поставить следующим</span>
      </button>
      <button class="context-item" data-action="toggle-fav">
        <span>${isFav ? 'Убрать из избранного' : 'В избранное'}</span>
      </button>
      ${track.album ? `
        <button class="context-item" data-action="open-album">
          <span>Перейти к альбому</span>
        </button>
        <button class="context-item" data-action="toggle-fav-album">
          <span>${isFavAlbum ? 'Убрать альбом из избранного' : 'Альбом в избранное'}</span>
        </button>
      ` : ''}
      ${track.artistId ? `
        <button class="context-item" data-action="toggle-fav-artist">
          <span>${isFavArtist ? 'Убрать артиста из избранного' : 'Артиста в избранное'}</span>
        </button>
      ` : ''}
      <div class="context-divider"></div>
      <div class="context-subheader">Добавить в плейлист</div>
      ${playlists.map(pl => `
        <button class="context-item" data-action="add-to-playlist" data-playlist-id="${pl.id}">
          <span>${escapeHtml(pl.name)}</span>
          <span class="context-count">${pl.trackIds.length}</span>
        </button>
      `).join('')}
      ${playlists.length === 0 ? '<div class="context-empty">Нет плейлистов</div>' : ''}
      <div class="context-divider"></div>
      <button class="context-item" data-action="share">
        <span>Поделиться</span>
      </button>
    `;

    const menuRect = $menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(x, vw - menuRect.width - 16);
    let top  = Math.min(y, vh - menuRect.height - 16);
    left = Math.max(16, left);
    top  = Math.max(16, top);
    $menu.style.left = `${left}px`;
    $menu.style.top  = `${top}px`;

    $menu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'play-next') {
          window.PocuPlayer?.insertNext?.(track);
        } else if (action === 'toggle-fav') {
          const wasFav = window.PocuStore.favorites.has(track.id);
          window.PocuStore.favorites.toggle(track.id);
          window.PocuSupabase?.syncFavorite(track.id, !wasFav);
        } else if (action === 'open-album') {
          window.PocuAlbumUI?.open?.(track.artist, track.album);
        } else if (action === 'toggle-fav-album') {
          const now = window.PocuStore.favoriteAlbums.toggle(track.artist, track.album);
          window.PocuSupabase?.syncFavoriteAlbum?.(track.artist, track.album, now);
          document.dispatchEvent(new CustomEvent('album:favorites-change', {
            detail: { artist: track.artist, album: track.album, active: now }
          }));
        } else if (action === 'toggle-fav-artist') {
          const now = window.PocuStore.favoriteArtists.toggle(track.artistId);
          window.PocuSupabase?.syncFavoriteArtist?.(track.artistId, now);
          document.dispatchEvent(new CustomEvent('artist:favorites-change', {
            detail: { id: track.artistId, active: now }
          }));
        } else if (action === 'add-to-playlist') {
          const plId = btn.dataset.playlistId;
          window.PocuStore.playlists.addTrack(plId, track.id);
          window.PocuSupabase?.syncPlaylistTrackAdd(plId, track.id);
        } else if (action === 'share') {
          // Deep-link: генерируем канонический URL вида .../#track/<id>
          const url = window.PocuRouter?.build?.('track', track.id) || window.location.href;
          const title = track.title;
          const text  = `${track.artist} — ${track.title}`;
          if (window.PocuShare?.share) {
            window.PocuShare.share(url, title, text);
          } else if (navigator.share) {
            navigator.share({ title, text, url }).catch(() => {});
          }
        }
        close();
      });
    });

    $overlay.classList.add('open');
  }

  function close() {
    $overlay.classList.remove('open');
    activeTrack = null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  return {
    init,
    close,
    openAt: (track, x, y) => open(track, x, y),
    isSuppressingClick: () => suppressTileClick
  };
})();