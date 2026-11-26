/* Pocu Music — экран «Избранное» (v2: превью-секции + overlay-страницы) */
window.PocuFavoritesUI = (() => {
  let els = {};
  let initialized = false;
  let first = true;
  let lastHash = '';

  const LIKED_PREVIEW = 8;   // 4 ряда × 2 колонки
  const ROW_LIMIT     = 8;

  /* ---- История (фильтры + группировка) ---- */
  let historyFilterKey = null;
  let historyGroupsCache = [];

  function init() {
    if (initialized) return;
    initialized = true;

    els = {
      /* Favorites */
      emptyBlock:    document.getElementById('favEmpty'),
      likedSection:  document.getElementById('favLiked'),
      likedPreview:  document.getElementById('favLikedTracks'),
      albumsSection: document.getElementById('favAlbums'),
      albumsRow:     document.getElementById('favAlbumsRow'),
      recentSection: document.getElementById('favRecent'),
      recentRow:     document.getElementById('favRecentRow'),
      artistsSection:document.getElementById('favArtists'),
      artistsRow:    document.getElementById('favArtistsRow'),

      /* Liked tracks page */
      likedScreen:   document.getElementById('likedTracksScreen'),
      likedBack:     document.getElementById('likedTracksBackBtn'),
      likedInfo:     document.getElementById('likedTracksInfo'),
      likedActions:  document.getElementById('likedTracksActions'),
      likedList:     document.getElementById('likedTracksList'),

      /* Liked albums page */
      likedAlbumsScreen: document.getElementById('likedAlbumsScreen'),
      likedAlbumsBack:   document.getElementById('likedAlbumsBackBtn'),
      likedAlbumsInfo:   document.getElementById('likedAlbumsInfo'),
      likedAlbumsList:   document.getElementById('likedAlbumsList'),

      /* All playlists page */
      allPlScreen:   document.getElementById('allPlaylistsScreen'),
      allPlBack:     document.getElementById('allPlaylistsBackBtn'),
      allPlInfo:     document.getElementById('allPlaylistsInfo'),
      allPlList:     document.getElementById('allPlaylistsList'),

      /* Liked artists page */
      likedArtistsScreen: document.getElementById('likedArtistsScreen'),
      likedArtistsBack:   document.getElementById('likedArtistsBackBtn'),
      likedArtistsInfo:   document.getElementById('likedArtistsInfo'),
      likedArtistsList:   document.getElementById('likedArtistsList')
    };

    /* --- ">" links --- */
    document.querySelectorAll('.section-head-btn[data-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.open;
        if (t === 'liked-tracks')  openLikedTracks();
        else if (t === 'liked-albums')  openLikedAlbums();
        else if (t === 'all-playlists') openAllPlaylists();
        else if (t === 'liked-artists') openLikedArtists();
        else if (t === 'history')       openHistory();
      });
    });

    /* --- Back --- */
    els.likedBack?.addEventListener('click', () => closeOverlay(els.likedScreen));
    els.likedAlbumsBack?.addEventListener('click', () => closeOverlay(els.likedAlbumsScreen));
    els.allPlBack?.addEventListener('click', () => closeOverlay(els.allPlScreen));
    els.likedArtistsBack?.addEventListener('click', () => closeOverlay(els.likedArtistsScreen));
    document.getElementById('historyBackBtn')?.addEventListener('click', () => closeOverlay(document.getElementById('historyScreen')));

    /* --- Escape --- */
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      for (const scr of [els.likedScreen, els.likedAlbumsScreen, els.allPlScreen, els.likedArtistsScreen]) {
        if (scr?.classList.contains('open')) { closeOverlay(scr); return; }
      }
      const h = document.getElementById('historyScreen');
      if (h?.classList.contains('open')) closeOverlay(h);
    });

    /* --- Close on tab click (capture: до app.js) --- */
    document.addEventListener('click', e => {
      if (!e.target.closest('.tab-item, #sidebarSettingsBtn')) return;
      for (const scr of [els.likedScreen, els.likedAlbumsScreen, els.allPlScreen, els.likedArtistsScreen]) {
        if (scr?.classList.contains('open')) closeOverlay(scr);
      }
      const h = document.getElementById('historyScreen');
      if (h?.classList.contains('open')) closeOverlay(h);
    }, true);

    /* --- Player subscription --- */
    window.PocuPlayer.subscribe(state => {
      if (els.likedPreview)  PocuTrackCard.syncPlaying(els.likedPreview, state);
      if (els.likedList)     PocuTrackCard.syncPlaying(els.likedList, state);
      const h = document.getElementById('historyTracks');
      if (h) PocuTrackCard.syncPlaying(h, state);
      syncRecentPlaying(state);
    });

    /* --- Store subscription --- */
    window.PocuStore.subscribe(state => {
      const hash = [
        state.favorites.join(','),
        state.recent.map(r => r.id).join(','),
        state.favoriteAlbums.join(','),
        state.favoriteArtists.join(','),
        (state.favoritePlaylists || []).map(p => p.id).join(',')
      ].join('|');

      if (els.likedPreview) PocuTrackCard.syncHearts(els.likedPreview, state.favorites);
      if (els.likedList)    PocuTrackCard.syncHearts(els.likedList, state.favorites);
      const h = document.getElementById('historyTracks');
      if (h) PocuTrackCard.syncHearts(h, state.favorites);

      if (hash === lastHash) return;
      lastHash = hash;
      render(first);
      first = false;
    });

    document.addEventListener('album:favorites-change',  () => render(false));
    document.addEventListener('artist:favorites-change', () => render(false));

    render(true);
    lastHash = [
      window.PocuStore.favorites.all().join(','),
      window.PocuStore.recent.all().map(r => r.id).join(','),
      window.PocuStore.favoriteAlbums.all().join(','),
      window.PocuStore.favoriteArtists.all().join(','),
      (window.PocuStore.favoritePlaylists.all() || []).map(p => p.id).join(',')
    ].join('|');
    first = false;
  }

  function syncRecentPlaying(state) {
    if (!els.recentRow) return;
    const curId = state.track?.id;
    els.recentRow.querySelectorAll('.recent-tile[data-id]').forEach(el => {
      el.classList.toggle('playing', !!(state.playing && el.dataset.id === curId));
    });
  }

  /* ============================================================
     Favorites preview sections
     ============================================================ */

  function render(animate) {
    const liked   = window.PocuStore.favorites.all().length;
    const albums  = window.PocuStore.favoriteAlbums.all().length;
    const artists = window.PocuStore.favoriteArtists.all().length;
    const recent  = window.PocuStore.recent.all().length;

    const showEmpty = !liked && !albums && !artists && !recent;
    if (els.emptyBlock) els.emptyBlock.hidden = !showEmpty;

    renderLiked(animate);
    renderAlbums();
    renderRecent();
    renderArtists();
  }

  function renderLiked(animate) {
    if (!els.likedSection || !els.likedPreview) return;
    const ids = window.PocuStore.favorites.all();
    if (!ids.length) { els.likedSection.hidden = true; els.likedPreview.replaceChildren(); return; }

    const lib = window.PocuLibrary.all();
    const map = new Map(lib.map(t => [t.id, t]));
    const ordered = ids.map(id => map.get(id)).filter(Boolean);
    if (!ordered.length) { els.likedSection.hidden = true; return; }

    els.likedSection.hidden = false;
    const preview = ordered.slice(0, LIKED_PREVIEW);

    els.likedPreview.replaceChildren();
    const frag = document.createDocumentFragment();
    preview.forEach((track, i) => {
      frag.appendChild(PocuTrackCard.create(track, {
        index: animate ? i : 0,
        animate,
        onPlay: () => window.PocuPlayer.playQueue(ordered, i)
      }));
    });
    els.likedPreview.appendChild(frag);

    PocuTrackCard.syncPlaying(els.likedPreview, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts(els.likedPreview, window.PocuStore.favorites.all());
  }

  function renderAlbums() {
    if (!els.albumsSection || !els.albumsRow) return;
    const list = window.PocuStore.favoriteAlbums.list();
    if (!list.length) { els.albumsSection.hidden = true; els.albumsRow.replaceChildren(); return; }
    els.albumsSection.hidden = false;
    els.albumsRow.replaceChildren();

    const lib = window.PocuLibrary.all();
    list.slice(0, ROW_LIMIT).forEach(({ artist, album }) => {
      const tracks = lib.filter(t => t.artist === artist && t.album === album);
      const art = tracks.find(t => t.artwork)?.artwork || '';
      els.albumsRow.appendChild(createAlbumTile(artist, album, art));
    });
  }

  function renderRecent() {
    if (!els.recentSection || !els.recentRow) return;
    const recents = window.PocuStore.recent.all().slice(0, ROW_LIMIT);
    if (!recents.length) { els.recentSection.hidden = true; els.recentRow.replaceChildren(); return; }

    const lib = window.PocuLibrary.all();
    const map = new Map(lib.map(t => [t.id, t]));
    const ordered = recents.map(r => map.get(r.id)).filter(Boolean);
    if (!ordered.length) { els.recentSection.hidden = true; return; }

    els.recentSection.hidden = false;
    els.recentRow.replaceChildren();
    ordered.forEach(track => els.recentRow.appendChild(createRecentTile(track, ordered)));
  }

  function renderArtists() {
    if (!els.artistsSection || !els.artistsRow) return;
    const ids = window.PocuStore.favoriteArtists.all();
    if (!ids.length) { els.artistsSection.hidden = true; els.artistsRow.replaceChildren(); return; }
    els.artistsSection.hidden = false;
    els.artistsRow.replaceChildren();

    const lib = window.PocuLibrary.all();
    ids.slice(0, ROW_LIMIT).forEach(id => {
      const pocu = window.PocuArtists.get(id);
      let name, photo;
      if (pocu) { name = pocu.name; photo = pocu.photo; }
      else {
        name = id;
        const lower = id.toLowerCase();
        const t = lib.filter(x => window.PocuArtists.splitArtists(x.artist).includes(lower));
        photo = t.find(x => x.artwork)?.artwork || '';
      }
      els.artistsRow.appendChild(createArtistTile(id, name, photo));
    });
  }

  /* ============================================================
     Overlays
     ============================================================ */

  function openLikedTracks() {
    if (!els.likedScreen) return;
    const ids = window.PocuStore.favorites.all();
    const lib = window.PocuLibrary.all();
    const map = new Map(lib.map(t => [t.id, t]));
    const ordered = ids.map(id => map.get(id)).filter(Boolean);

    const totalSec = ordered.reduce((s, t) => s + (t.duration || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    const parts = [`${ordered.length} ${plural(ordered.length)}`];
    if (totalMin > 0) parts.push(`${totalMin} мин.`);
    if (els.likedInfo) els.likedInfo.textContent = parts.join(' • ');

    if (els.likedActions) {
      els.likedActions.replaceChildren();
      if (ordered.length) {
        const play = document.createElement('button');
        play.className = 'btn btn-primary';
        play.textContent = 'Играть всё';
        play.addEventListener('click', () => window.PocuPlayer.playQueue(ordered, 0));
        const sh = document.createElement('button');
        sh.className = 'btn btn-secondary';
        sh.textContent = 'Перемешать';
        sh.addEventListener('click', () => {
          const s = [...ordered].sort(() => Math.random() - 0.5);
          window.PocuPlayer.playQueue(s, 0);
        });
        els.likedActions.append(play, sh);
      }
    }

    if (els.likedList) {
      els.likedList.replaceChildren();
      if (!ordered.length) {
        els.likedList.innerHTML = `<div class="state-block"><div class="state-title">Пока пусто</div></div>`;
      } else {
        const frag = document.createDocumentFragment();
        ordered.forEach((t, i) => {
          frag.appendChild(PocuTrackCard.create(t, {
            index: i,
            onPlay: () => window.PocuPlayer.playQueue(ordered, i)
          }));
        });
        els.likedList.appendChild(frag);
        PocuTrackCard.syncPlaying(els.likedList, window.PocuPlayer.getState());
        PocuTrackCard.syncHearts(els.likedList, window.PocuStore.favorites.all());
      }
    }
    openOverlay(els.likedScreen);
  }

  function openLikedAlbums() {
    if (!els.likedAlbumsScreen) return;
    const list = window.PocuStore.favoriteAlbums.list();
    if (els.likedAlbumsInfo) els.likedAlbumsInfo.textContent = `${list.length} ${pluralAlbums(list.length)}`;

    if (els.likedAlbumsList) {
      els.likedAlbumsList.replaceChildren();
      if (!list.length) {
        els.likedAlbumsList.innerHTML = `<div class="state-block"><div class="state-title">Пока пусто</div></div>`;
      } else {
        const lib = window.PocuLibrary.all();
        list.forEach(({ artist, album }) => {
          const tracks = lib.filter(t => t.artist === artist && t.album === album);
          const art = tracks.find(t => t.artwork)?.artwork || '';
          els.likedAlbumsList.appendChild(createAlbumTile(artist, album, art));
        });
      }
    }
    openOverlay(els.likedAlbumsScreen);
  }

  function openAllPlaylists() {
    if (!els.allPlScreen) return;
    const own   = window.PocuStore.playlists.all();
    const liked = window.PocuStore.favoritePlaylists.all();
    const items = [
      ...own.map(pl => ({ pl, mode: 'own' })),
      ...liked.map(pl => ({ pl, mode: 'public' }))
    ];

    if (els.allPlInfo) els.allPlInfo.textContent = `${items.length} ${pluralPlaylists(items.length)}`;

    if (els.allPlList) {
      els.allPlList.replaceChildren();
      if (!items.length) {
        els.allPlList.innerHTML = `<div class="state-block"><div class="state-title">Пока пусто</div><div class="state-sub">Создай плейлист — он появится здесь</div></div>`;
      } else {
        items.forEach(({ pl, mode }) => els.allPlList.appendChild(createPlaylistTile(pl, mode)));
      }
    }
    openOverlay(els.allPlScreen);
  }

  function openLikedArtists() {
    if (!els.likedArtistsScreen) return;
    const ids = window.PocuStore.favoriteArtists.all();
    if (els.likedArtistsInfo) els.likedArtistsInfo.textContent = `${ids.length} ${pluralArtists(ids.length)}`;

    if (els.likedArtistsList) {
      els.likedArtistsList.replaceChildren();
      if (!ids.length) {
        els.likedArtistsList.innerHTML = `<div class="state-block"><div class="state-title">Пока пусто</div></div>`;
      } else {
        const lib = window.PocuLibrary.all();
        ids.forEach(id => {
          const pocu = window.PocuArtists.get(id);
          let name, photo;
          if (pocu) { name = pocu.name; photo = pocu.photo; }
          else {
            name = id;
            const lower = id.toLowerCase();
            const t = lib.filter(x => window.PocuArtists.splitArtists(x.artist).includes(lower));
            photo = t.find(x => x.artwork)?.artwork || '';
          }
          els.likedArtistsList.appendChild(createArtistTile(id, name, photo));
        });
      }
    }
    openOverlay(els.likedArtistsScreen);
  }

  /* ============================================================
     History (carry over из предыдущего патча)
     ============================================================ */

  function openHistory() {
    const $hist = document.getElementById('historyTracks');
    const scr   = document.getElementById('historyScreen');
    if (!$hist || !scr) return;

    const recent = window.PocuStore.recent.all();
    const lib    = window.PocuLibrary.all();
    const map    = new Map(lib.map(t => [t.id, t]));
    const items  = recent
      .map(r => ({ track: map.get(r.id), t: r.t || 0 }))
      .filter(x => x.track);

    const groupsMap = new Map();
    items.forEach(({ track, t }) => {
      const d = new Date(t || Date.now());
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!groupsMap.has(key)) groupsMap.set(key, { key, date: d, items: [] });
      groupsMap.get(key).items.push({ track, t });
    });

    historyGroupsCache = [...groupsMap.values()].sort((a, b) => b.date - a.date);
    if (historyFilterKey && !historyGroupsCache.some(g => g.key === historyFilterKey)) {
      historyFilterKey = null;
    }

    renderHistoryFilters();
    renderHistoryList();
    openOverlay(scr);
  }

  function renderHistoryFilters() {
    const $f = document.getElementById('historyFilters');
    if (!$f) return;
    $f.replaceChildren();
    const top = historyGroupsCache.slice(0, 7);
    if (!top.length) { $f.hidden = true; return; }
    $f.hidden = false;

    top.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.dateKey = g.key;
      b.textContent = dateLabel(g.date);
      if (historyFilterKey === g.key) b.classList.add('active');
      b.addEventListener('click', () => {
        historyFilterKey = (historyFilterKey === g.key) ? null : g.key;
        renderHistoryFilters();
        renderHistoryList();
      });
      $f.appendChild(b);
    });
  }

  function renderHistoryList() {
    const $hist = document.getElementById('historyTracks');
    if (!$hist) return;
    if (!historyGroupsCache.length) {
      $hist.innerHTML = `<div class="state-block"><div class="state-title">Пока пусто</div></div>`;
      return;
    }
    const groups = historyFilterKey
      ? historyGroupsCache.filter(g => g.key === historyFilterKey)
      : historyGroupsCache;
    const visible = [];
    groups.forEach(g => g.items.forEach(it => visible.push(it.track)));

    $hist.replaceChildren();
    const frag = document.createDocumentFragment();
    let idx = 0;
    groups.forEach(g => {
      const h = document.createElement('div');
      h.className = 'history-date-header';
      h.textContent = dateLabel(g.date);
      frag.appendChild(h);
      g.items.forEach(it => {
        const myIdx = idx++;
        frag.appendChild(PocuTrackCard.create(it.track, {
          index: myIdx,
          onPlay: () => window.PocuPlayer.playQueue(visible, myIdx)
        }));
      });
    });
    $hist.appendChild(frag);

    PocuTrackCard.syncPlaying($hist, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts($hist, window.PocuStore.favorites.all());
  }

  function dateLabel(date) {
    const now = new Date();
    const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((todayStart - targetStart) / 86400000);
    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    const opts = { day: 'numeric', month: 'long' };
    if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
    return date.toLocaleDateString('ru-RU', opts).replace(/\s*г\.$/, '');
  }

  /* ============================================================
     Helpers
     ============================================================ */

  function createAlbumTile(artist, album, artwork) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'home-tile';

    const artWrap = document.createElement('div');
    artWrap.className = 'home-tile-art-wrap';
    const art = document.createElement('div');
    art.className = 'home-tile-art';
    if (artwork) art.style.backgroundImage = `url("${artwork}")`;
    artWrap.appendChild(art);

    const info = document.createElement('div');
    info.className = 'home-tile-info';
    const text = document.createElement('div');
    text.className = 'home-tile-text';
    const name = document.createElement('div');
    name.className = 'home-tile-name';
    name.textContent = album;
    const artistEl = document.createElement('div');
    artistEl.className = 'home-tile-artist';
    artistEl.textContent = artist;
    text.append(name, artistEl);
    info.appendChild(text);
    tile.append(artWrap, info);

    tile.addEventListener('click', () => window.PocuAlbumUI?.open?.(artist, album));
    return tile;
  }

  function createArtistTile(id, name, photo) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'home-tile';

    const artWrap = document.createElement('div');
    artWrap.className = 'home-tile-art-wrap home-tile-art-wrap--round';
    const art = document.createElement('div');
    art.className = 'home-tile-art home-tile-art--round';
    if (photo) art.style.backgroundImage = `url("${photo}")`;
    else {
      art.classList.add('home-tile-art--placeholder');
      art.textContent = name.slice(0, 1).toUpperCase();
    }
    artWrap.appendChild(art);

    const info = document.createElement('div');
    info.className = 'home-tile-info';
    const text = document.createElement('div');
    text.className = 'home-tile-text';
    const nameEl = document.createElement('div');
    nameEl.className = 'home-tile-name';
    nameEl.textContent = name;
    text.appendChild(nameEl);
    info.appendChild(text);
    tile.append(artWrap, info);

    tile.addEventListener('click', () => window.PocuArtistUI?.openArtist?.(id));
    return tile;
  }

  function createPlaylistTile(pl, mode) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'home-tile';

    const artWrap = document.createElement('div');
    artWrap.className = 'home-tile-art-wrap';
    const art = document.createElement('div');
    art.className = 'home-tile-art';

    if (pl.coverUrl) art.style.backgroundImage = `url("${pl.coverUrl}")`;
    else {
      const first = pl.trackIds?.[0] ? window.PocuLibrary.get(pl.trackIds[0]) : null;
      if (first?.artwork) art.style.backgroundImage = `url("${first.artwork}")`;
      else {
        art.classList.add('home-tile-art--placeholder');
        art.textContent = (pl.name || '?').slice(0, 1).toUpperCase();
        art.style.background = 'linear-gradient(135deg, #7c5cff, #ff409e)';
      }
    }
    artWrap.appendChild(art);

    if (mode === 'public' || pl.isPublic) {
      const badge = document.createElement('div');
      badge.className = 'playlist-public-badge';
      badge.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';
      artWrap.appendChild(badge);
    }

    const info = document.createElement('div');
    info.className = 'home-tile-info';
    const text = document.createElement('div');
    text.className = 'home-tile-text';
    const name = document.createElement('div');
    name.className = 'home-tile-name';
    name.textContent = pl.name;
    const count = document.createElement('div');
    count.className = 'home-tile-artist';
    const n = (pl.trackIds || []).length;
    count.textContent = mode === 'public' && pl.authorName
      ? `${pl.authorName} · ${n} ${plural(n)}`
      : `${n} ${plural(n)}`;
    text.append(name, count);
    info.appendChild(text);
    tile.append(artWrap, info);

    tile.addEventListener('click', () => window.PocuPlaylistsUI?.openPlaylist?.(pl.id, mode));
    return tile;
  }

  function createRecentTile(track, ordered) {
    const el = document.createElement('div');
    el.className = 'recent-tile';
    el.setAttribute('role', 'button');
    el.dataset.id = track.id;

    const artWrap = document.createElement('div');
    artWrap.className = 'recent-art-wrap';
    const art = document.createElement('div');
    art.className = 'recent-art';
    if (track.artwork) art.style.backgroundImage = `url("${track.artwork}")`;

    const overlay = document.createElement('div');
    overlay.className = 'home-tile-play-overlay';
    overlay.innerHTML = `
      <svg class="icon-play"  viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>`;
    artWrap.append(art, overlay);

    const info = document.createElement('div');
    info.className = 'recent-tile-info';
    const text = document.createElement('div');
    text.className = 'recent-tile-text';
    const title = document.createElement('div');
    title.className = 'recent-title';
    title.textContent = track.title;
    text.appendChild(title);

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'tile-menu';
    menuBtn.setAttribute('aria-label', 'Действия');
    menuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>`;
    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      const r = menuBtn.getBoundingClientRect();
      window.PocuContextMenu?.openAt?.(track, r.right, r.top);
    });
    title.addEventListener('click', e => { e.stopPropagation(); window.PocuTrackCard.openTarget(track); });

    info.append(text, menuBtn);
    el.append(artWrap, info);

    el.addEventListener('click', e => {
      if (window.PocuContextMenu?.isSuppressingClick?.()) { e.stopPropagation(); e.preventDefault(); return; }
      const idx = ordered.findIndex(t => t.id === track.id);
      if (idx >= 0) window.PocuPlayer.playQueue(ordered, idx);
    });

    return el;
  }

  function openOverlay(scr) {
    if (!scr) return;
    window.PocuLayers?.front?.(scr);
    scr.classList.add('open');
    scr.setAttribute('aria-hidden', 'false');
    document.body.classList.add('playlist-open');
    requestAnimationFrame(() => {
      const inner = scr.querySelector('.playlist-overlay-inner');
      if (inner) inner.scrollTop = 0;
    });
  }

  function closeOverlay(scr) {
    if (!scr) return;
    window.PocuLayers?.reset?.(scr);
    scr.classList.remove('open');
    scr.setAttribute('aria-hidden', 'true');

    let stillOpen = [els.likedScreen, els.likedAlbumsScreen, els.allPlScreen, els.likedArtistsScreen]
      .some(s => s?.classList.contains('open'));
    const h = document.getElementById('historyScreen');
    if (h?.classList.contains('open')) stillOpen = true;
    if (!stillOpen) document.body.classList.remove('playlist-open');
  }

  function plural(n) {
    const m = n % 100;
    if (m >= 11 && m <= 14) return 'треков';
    const l = n % 10;
    if (l === 1) return 'трек';
    if (l >= 2 && l <= 4) return 'трека';
    return 'треков';
  }
  function pluralAlbums(n) {
    const m = n % 100;
    if (m >= 11 && m <= 14) return 'альбомов';
    const l = n % 10;
    if (l === 1) return 'альбом';
    if (l >= 2 && l <= 4) return 'альбома';
    return 'альбомов';
  }
  function pluralPlaylists(n) {
    const m = n % 100;
    if (m >= 11 && m <= 14) return 'плейлистов';
    const l = n % 10;
    if (l === 1) return 'плейлист';
    if (l >= 2 && l <= 4) return 'плейлиста';
    return 'плейлистов';
  }
  function pluralArtists(n) {
    const m = n % 100;
    if (m >= 11 && m <= 14) return 'артистов';
    const l = n % 10;
    if (l === 1) return 'артист';
    if (l >= 2 && l <= 4) return 'артиста';
    return 'артистов';
  }

  return { init };
})();