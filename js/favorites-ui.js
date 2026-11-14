/* Pocu Music — экран «Избранное» (объединённое с медиатекой) */
window.PocuFavoritesUI = (() => {
  let els = {};
  let initialized = false;
  let first = true;
  let lastHash = '';

  const HISTORY_LIMIT = 7;

  function init() {
    if (initialized) return;
    initialized = true;

    els = {
      container:      document.getElementById('favoritesList'),
      recentSection:  document.getElementById('favRecent'),
      recentRow:      document.getElementById('favRecentRow'),
      albumsSection:  document.getElementById('favAlbums'),
      albumsRow:      document.getElementById('favAlbumsRow'),
      artistsSection: document.getElementById('favArtists'),
      artistsRow:     document.getElementById('favArtistsRow'),
      tracksSection:  document.getElementById('favTracks'),
      tracksList:     document.getElementById('favTracksList'),
      emptyBlock:     document.getElementById('favEmpty')
    };

    window.PocuPlayer.subscribe(state => {
      PocuTrackCard.syncPlaying(els.tracksList, state);
      syncRecentPlaying(state);
    });

    window.PocuStore.subscribe(state => {
      const hash = [
        state.favorites.join(','),
        state.recent.map(r => r.id).join(','),
        state.favoriteAlbums.join(','),
        state.favoriteArtists.join(',')
      ].join('|');
      if (hash === lastHash) {
        PocuTrackCard.syncHearts(els.tracksList, state.favorites);
        return;
      }
      lastHash = hash;
      render(first);
      first = false;
    });

    document.addEventListener('album:favorites-change',  () => render(false));
    document.addEventListener('artist:favorites-change', () => render(false));

    // «Вся история»
    document.getElementById('favHistoryBtn')?.addEventListener('click', openHistory);
    document.getElementById('historyBackBtn')?.addEventListener('click', () => {
      const scr = document.getElementById('historyScreen');
      scr.classList.remove('open');
      scr.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('playlist-open');
    });

    render(true);
    lastHash = [
      window.PocuStore.favorites.all().join(','),
      window.PocuStore.recent.all().map(r => r.id).join(','),
      window.PocuStore.favoriteAlbums.all().join(','),
      window.PocuStore.favoriteArtists.all().join(',')
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

  /* ============ Недавно прослушано ============ */
  function renderRecent() {
    const recents = window.PocuStore.recent.all();
    if (!recents.length) { els.recentSection.hidden = true; return; }

    const all = window.PocuLibrary.all();
    const map = new Map(all.map(t => [t.id, t]));
    const ordered = recents.map(r => map.get(r.id)).filter(Boolean);
    if (!ordered.length) { els.recentSection.hidden = true; return; }

    els.recentSection.hidden = false;
    els.recentRow.replaceChildren();

    const display = ordered.slice(0, HISTORY_LIMIT);
    display.forEach(track => {
      els.recentRow.appendChild(createRecentTile(track, ordered));
    });

    if (ordered.length > HISTORY_LIMIT) {
      const btn = document.createElement('div');
      btn.className = 'recent-tile';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.innerHTML = `
        <div class="recent-art-wrap">
          <div class="recent-art" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border:1px solid var(--glass-brd);">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-dim);"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </div>
        <div class="recent-tile-info">
          <div class="recent-tile-text">
            <div class="recent-title">Вся история</div>
          </div>
        </div>`;
      btn.addEventListener('click', openHistory);
      els.recentRow.appendChild(btn);
    }
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

    title.addEventListener('click', e => {
      e.stopPropagation();
      window.PocuTrackCard.openTarget(track);
    });

    info.append(text, menuBtn);
    el.append(artWrap, info);

    el.addEventListener('click', (e) => {
      if (window.PocuContextMenu?.isSuppressingClick?.()) { e.stopPropagation(); e.preventDefault(); return; }
      const idx = ordered.findIndex(t => t.id === track.id);
      if (idx >= 0) window.PocuPlayer.playQueue(ordered, idx);
    });

    return el;
  }

  function openHistory() {
    const ordered = window.PocuStore.recent.all()
      .map(r => window.PocuLibrary.get(r.id)).filter(Boolean);

    const $hist = document.getElementById('historyTracks');
    $hist.replaceChildren();
    const frag = document.createDocumentFragment();
    ordered.forEach((track, i) => {
      frag.appendChild(PocuTrackCard.create(track, {
        index: i,
        onPlay: () => window.PocuPlayer.playQueue(ordered, i)
      }));
    });
    $hist.appendChild(frag);

    PocuTrackCard.syncPlaying($hist, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts($hist, window.PocuStore.favorites.all());

    const scr = document.getElementById('historyScreen');
    scr.classList.add('open');
    scr.setAttribute('aria-hidden', 'false');
    document.body.classList.add('playlist-open');
  }

  /* ============ Избранные альбомы ============ */
  function renderAlbums() {
    const list = window.PocuStore.favoriteAlbums.list();
    if (!list.length) { els.albumsSection.hidden = true; return; }

    els.albumsSection.hidden = false;
    els.albumsRow.replaceChildren();

    const lib = window.PocuLibrary.all();
    list.forEach(({ artist, album }) => {
      const tracks = lib.filter(t => t.artist === artist && t.album === album);
      const firstWithArt = tracks.find(t => t.artwork);
      els.albumsRow.appendChild(createAlbumTile(artist, album, firstWithArt?.artwork || ''));
    });
  }

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

  /* ============ Избранные артисты ============ */
  function renderArtists() {
    const ids = window.PocuStore.favoriteArtists.all();
    if (!ids.length) { els.artistsSection.hidden = true; return; }

    els.artistsSection.hidden = false;
    els.artistsRow.replaceChildren();

    const lib = window.PocuLibrary.all();
    ids.forEach(id => {
      const pocu = window.PocuArtists.get(id);
      let name, photo;
      if (pocu) { name = pocu.name; photo = pocu.photo; }
      else {
        name = id;
        const lower = id.toLowerCase();
        const tracks = lib.filter(t => window.PocuArtists.splitArtists(t.artist).includes(lower));
        photo = tracks.find(t => t.artwork)?.artwork || '';
      }
      els.artistsRow.appendChild(createArtistTile(id, name, photo));
    });
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

  /* ============ Избранные треки ============ */
  function renderTracks(animate) {
    const ids = window.PocuStore.favorites.all();
    const all = window.PocuLibrary.all();
    const map = new Map(all.map(t => [t.id, t]));
    const ordered = ids.map(id => map.get(id)).filter(Boolean);

    els.tracksList.replaceChildren();

    if (!ordered.length) {
      els.tracksSection.hidden = true;
      return;
    }
    els.tracksSection.hidden = false;

    const frag = document.createDocumentFragment();
    ordered.forEach((track, i) => {
      frag.appendChild(PocuTrackCard.create(track, {
        index: animate ? i : 0,
        animate,
        onPlay: () => window.PocuPlayer.playQueue(ordered, i)
      }));
    });
    els.tracksList.appendChild(frag);

    PocuTrackCard.syncPlaying(els.tracksList, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts(els.tracksList, window.PocuStore.favorites.all());
  }

  /* ============ Полный рендер ============ */
  function render(animate) {
    const favCount   = window.PocuStore.favorites.all().length;
    const albumCount = window.PocuStore.favoriteAlbums.all().length;
    const artCount   = window.PocuStore.favoriteArtists.all().length;
    const recentHas  = window.PocuStore.recent.all().length > 0;
    const plCount    = window.PocuStore.playlists.all().length;

    const showEmpty = !favCount && !albumCount && !artCount && !recentHas && !plCount;
    if (els.emptyBlock) els.emptyBlock.hidden = !showEmpty;

    renderRecent();
    renderAlbums();
    renderArtists();
    renderTracks(animate);
  }

  return { init };
})();