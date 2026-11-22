/* Pocu Music — экран артиста (Yandex-like layout) */
window.PocuArtistUI = (() => {
  let els = {};
  let initialized = false;
  let currentArtistId = null;
  let lastHomeHash = '';
  let lastLibHash = '';
  let artistMenuOverlay = null;
  let artistMenu = null;

  const GRADIENT = 'linear-gradient(135deg, rgba(124,92,255,.6), rgba(255,64,158,.4) 55%, rgba(56,132,255,.5))';
  const ICON_MORE = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>';

  function init() {
    if (initialized) return;
    initialized = true;

    /* === Сборка нового экрана артиста === */
    const screen = document.getElementById('artistScreen');
    if (screen) {
      screen.innerHTML = `
        <div class="artist-overlay-inner entity-page">
          <button class="back-btn entity-back" id="artistBackBtn" aria-label="Назад">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>Назад</span>
          </button>

          <div class="artist-header">
            <div class="artist-photo-wrap">
              <div class="artist-photo" id="artistPhoto"></div>
            </div>
            <div class="artist-meta">
              <div class="entity-type">Исполнитель</div>
              <h1 class="entity-title" id="artistName">—</h1>
              <div class="entity-info" id="artistInfo">—</div>
              <div class="entity-actions" id="artistActions"></div>
            </div>
          </div>

          <div class="artist-content">
            <div class="artist-top-tracks">
              <div class="section-head"><h2>Популярные треки</h2></div>
              <div id="artistTracks" class="entity-tracks"></div>
              <button class="btn btn-secondary artist-show-all" id="artistShowAllTracks" style="display:none;margin-top:16px;">Показать все</button>
            </div>
            <div class="artist-new-release" id="artistNewRelease"></div>
          </div>

          <div class="artist-discography">
            <div id="artistAlbumsSection" style="display:none;">
              <div class="section-head"><h2>Альбомы</h2></div>
              <div class="home-row" id="artistAlbumsRow"></div>
            </div>
            <div id="artistTracksSection" style="display:none;">
              <div class="section-head"><h2>Все треки</h2></div>
              <div class="home-row" id="artistTracksRow"></div>
            </div>
          </div>
        </div>
      `;
    }

    /* === Оверлей "Все треки" === */
    if (!document.getElementById('artistAllTracksScreen')) {
      const allScreen = document.createElement('div');
      allScreen.className = 'playlist-overlay';
      allScreen.id = 'artistAllTracksScreen';
      allScreen.setAttribute('aria-hidden', 'true');
      allScreen.innerHTML = `
        <div class="playlist-overlay-inner entity-page">
          <button class="back-btn entity-back" id="artistAllTracksBackBtn" aria-label="Назад">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>Назад</span>
          </button>
          <div class="entity-meta" style="margin-bottom: 24px;">
            <div class="entity-type">Исполнитель</div>
            <h1 class="entity-title" id="artistAllTracksName">—</h1>
            <div class="entity-info" id="artistAllTracksInfo"></div>
          </div>
          <div id="artistAllTracksList" class="entity-tracks"></div>
        </div>
      `;
      document.body.appendChild(allScreen);
      allScreen.querySelector('#artistAllTracksBackBtn').addEventListener('click', () => {
        window.PocuLayers?.reset?.(allScreen);
        allScreen.classList.remove('open');
        allScreen.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('playlist-open');
      });
    }

    els = {
      homeSection: document.getElementById('homePocuArtists'),
      homeRow:     document.getElementById('homePocuArtistsRow'),
      libSection:  document.getElementById('favPocuArtists'),
      libRow:      document.getElementById('favPocuArtistsRow'),
      screen:      document.getElementById('artistScreen'),
      back:        document.getElementById('artistBackBtn'),
      photo:       document.getElementById('artistPhoto'),
      name:        document.getElementById('artistName'),
      info:        document.getElementById('artistInfo'),
      actions:     document.getElementById('artistActions'),
      tracks:      document.getElementById('artistTracks'),
      showAllBtn:  document.getElementById('artistShowAllTracks'),
      newRelease:  document.getElementById('artistNewRelease'),
      albumsSection: document.getElementById('artistAlbumsSection'),
      albumsRow:   document.getElementById('artistAlbumsRow'),
      tracksSection: document.getElementById('artistTracksSection'),
      tracksRow:   document.getElementById('artistTracksRow'),
      allScreen:   document.getElementById('artistAllTracksScreen'),
      allName:     document.getElementById('artistAllTracksName'),
      allInfo:     document.getElementById('artistAllTracksInfo'),
      allList:     document.getElementById('artistAllTracksList')
    };

    if (els.back) els.back.addEventListener('click', closeArtist);

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (artistMenuOverlay?.classList.contains('open')) { closeArtistMenu(); return; }
      if (els.allScreen?.classList.contains('open')) {
        els.allScreen.classList.remove('open');
        els.allScreen.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('playlist-open');
        return;
      }
      if (currentArtistId) closeArtist();
    });

    window.PocuPlayer.subscribe(state => {
      if (currentArtistId) {
        if (els.tracks) PocuTrackCard.syncPlaying(els.tracks, state);
        if (els.allList) PocuTrackCard.syncPlaying(els.allList, state);
      }
    });

    window.PocuStore.subscribe(state => {
      if (currentArtistId) {
        if (els.tracks) PocuTrackCard.syncHearts(els.tracks, state.favorites);
        if (els.allList) PocuTrackCard.syncHearts(els.allList, state.favorites);
      }
      safe(renderHomeSection);
      safe(renderLibSection);
    });

    ensureArtistMenu();
    safe(renderHomeSection);
    safe(renderLibSection);
    /* Закрываем оверлеи артиста при клике на табы сайдбара (capture = до app.js) */
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tab-item, #sidebarSettingsBtn, #sidebarToggle')) return;

      if (els.allScreen?.classList.contains('open')) {
        window.PocuLayers?.reset?.(els.allScreen);
        els.allScreen.classList.remove('open');
        els.allScreen.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('playlist-open');
      }
      if (currentArtistId) {
        closeArtist();
      }
    }, true); // ← capture phase: срабатывает ДО основного обработчика таба
  }

  function safe(fn) { try { fn(); } catch (e) { console.warn('[artist-ui]', fn.name, e.message); } }
  function renderHomeSection() { renderSection(els.homeSection, els.homeRow, 'home'); }
  function renderLibSection()  { renderSection(els.libSection,  els.libRow,  'lib'); }

  function renderSection(section, row, kind) {
    if (!section || !row) return;
    const list = window.PocuArtists.featured();
    if (!list.length) {
      section.hidden = true;
      if (kind === 'home') lastHomeHash = ''; else lastLibHash = '';
      return;
    }
    const hash = list.map(a => a.id).join(',');
    if (kind === 'home' && hash === lastHomeHash) return;
    if (kind === 'lib'  && hash === lastLibHash)  return;
    if (kind === 'home') lastHomeHash = hash; else lastLibHash = hash;
    section.hidden = false;
    row.replaceChildren();
    list.forEach(artist => row.appendChild(createArtistTile(artist)));
  }

  function createArtistTile(artist) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'home-tile';

    const art = document.createElement('div');
    art.className = 'home-tile-art home-tile-art--round';
    if (artist.photo) art.style.backgroundImage = `url("${artist.photo}"), ${GRADIENT}`;
    else {
      art.classList.add('home-tile-art--placeholder');
      art.textContent = artist.name.slice(0, 1).toUpperCase();
    }

    const name = document.createElement('div');
    name.className = 'home-tile-name';
    name.textContent = artist.name;

    const count = document.createElement('div');
    count.className = 'home-tile-artist';
    const n = window.PocuArtists.tracksFor(artist.id).length;
    count.textContent = n ? `${n} ${plural(n)}` : 'Нет треков';

    el.append(art, name, count);
    el.addEventListener('click', () => openArtist(artist.id));
    return el;
  }

  function plural(n) {
    const m = n % 100;
    if (m >= 11 && m <= 14) return 'треков';
    const l = n % 10;
    if (l === 1) return 'трек';
    if (l >= 2 && l <= 4) return 'трека';
    return 'треков';
  }

  function findArtist(idStr) {
    const key = String(idStr || '').trim();
    if (!key) return null;
    let a = window.PocuArtists.get(key);
    if (a) return a;
    const lower = key.toLowerCase();
    a = window.PocuArtists.all().find(x =>
      x.name.toLowerCase() === lower ||
      String(x.id).toLowerCase() === lower ||
      (Array.isArray(x.aliases) && x.aliases.some(al => String(al).toLowerCase() === lower))
    );
    return a;
  }

  function findTracksByArtistName(name) {
    const lower = String(name || '').trim().toLowerCase();
    if (!lower) return [];
    return window.PocuLibrary.all().filter(t => {
      const parts = window.PocuArtists.splitTrackArtists(t);
      return parts.some(p => p.toLowerCase() === lower);
    });
  }

  function openArtist(artistIdOrName) {
    const idStr = String(artistIdOrName || '').trim();
    if (!idStr) return;

    let artist = findArtist(idStr);
    let tracks;

    if (artist) {
      tracks = window.PocuArtists.tracksFor(artist.id);
    } else {
      tracks = findTracksByArtistName(idStr);
      if (!tracks.length) return;
      const firstWithArt = tracks.find(t => t.artwork);
      const displayName = (() => {
        for (const t of tracks) {
          const parts = window.PocuArtists.splitTrackArtists(t);
          const found = parts.find(p => p.toLowerCase() === idStr.toLowerCase());
          if (found) return found;
        }
        return idStr;
      })();
      artist = { id: idStr, name: displayName, photo: firstWithArt?.artwork || '' };
    }

    currentArtistId = artist.id;
    window.PocuRouter?.setHash?.('artist', artist.id);

    // Hero
    els.name.textContent = artist.name;
    els.info.textContent = `${tracks.length} ${plural(tracks.length)}`;

    if (artist.photo) {
      els.photo.style.backgroundImage = `url("${artist.photo}"), ${GRADIENT}`;
      els.photo.classList.remove('artist-photo--placeholder');
      els.photo.textContent = '';
    } else {
      els.photo.style.backgroundImage = GRADIENT;
      els.photo.classList.add('artist-photo--placeholder');
      els.photo.textContent = artist.name.slice(0, 1).toUpperCase();
    }

    renderActions(artist, tracks);
    renderContent(artist, tracks);

    window.PocuLayers?.front?.(els.screen);
    els.screen.classList.add('open');
    els.screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('artist-open');
    requestAnimationFrame(() => { els.screen.scrollTop = 0; });
  }

  function renderActions(artist, tracks) {
    els.actions.replaceChildren();
    if (tracks.length) {
      const playAll = document.createElement('button');
      playAll.className = 'btn btn-primary';
      playAll.textContent = 'Слушать';
      playAll.addEventListener('click', () => window.PocuPlayer.playQueue(tracks, 0));

      const shuffleBtn = document.createElement('button');
      shuffleBtn.className = 'btn btn-secondary';
      shuffleBtn.textContent = 'Перемешать';
      shuffleBtn.addEventListener('click', () => {
        const s = [...tracks].sort(() => Math.random() - 0.5);
        window.PocuPlayer.playQueue(s, 0);
      });

      els.actions.append(playAll, shuffleBtn);
    }

    const heart = document.createElement('button');
    heart.type = 'button';
    heart.className = 'fav-heart';
    heart.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20.2s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.2 2.7c0 4.9-7.2 9.3-7.2 9.3z"/>
      </svg>`;

    const update = () => {
      const has = window.PocuStore.favoriteArtists.has(artist.id);
      heart.classList.toggle('active', has);
      heart.setAttribute('aria-label', has ? 'Убрать из избранного' : 'В избранное');
    };
    update();

    heart.addEventListener('click', () => {
      const now = window.PocuStore.favoriteArtists.toggle(artist.id);
      update();
      window.PocuSupabase?.syncFavoriteArtist?.(artist.id, now);
      if (now) {
        heart.classList.add('just-activated');
        setTimeout(() => heart.classList.remove('just-activated'), 450);
      }
    });
    els.actions.appendChild(heart);

    // [...] меню
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'entity-menu';
    moreBtn.setAttribute('aria-label', 'Ещё');
    moreBtn.innerHTML = ICON_MORE;
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      openArtistMenu(moreBtn, artist);
    });
    els.actions.appendChild(moreBtn);
  }

  function renderContent(artist, tracks) {
    // 1. Топ-5 треков
    const topTracks = tracks.slice(0, 5);
    els.tracks.replaceChildren();
    const fragTop = document.createDocumentFragment();
    topTracks.forEach((track, i) => {
      fragTop.appendChild(PocuTrackCard.create(track, {
        index: i,
        onPlay: () => window.PocuPlayer.playQueue(tracks, i)
      }));
    });
    els.tracks.appendChild(fragTop);

    if (tracks.length > 5) {
      els.showAllBtn.style.display = '';
      els.showAllBtn.onclick = () => openAllTracks(artist, tracks);
    } else {
      els.showAllBtn.style.display = 'none';
    }

    // 2. Новый релиз (берем последний трек/альбом)
    els.newRelease.replaceChildren();
    if (tracks.length > 0) {
      const latestTrack = tracks[tracks.length - 1];
      let cover = latestTrack.artwork || '';
      let title = latestTrack.album || latestTrack.title;
      let sub = latestTrack.album ? artist.name : 'Сингл';

      // Если это альбом, попробуем найти обложку получше
      if (latestTrack.album) {
        const albumTracks = tracks.filter(t => t.album === latestTrack.album);
        const firstWithArt = albumTracks.find(t => t.artwork);
        if (firstWithArt) cover = firstWithArt.artwork;
      }

      els.newRelease.innerHTML = `
        <div class="section-head"><h2>Новый релиз</h2></div>
        <div class="new-release-card">
          <div class="new-release-cover" style="background-image:url('${cover}')"></div>
          <div class="new-release-title">${escapeHtml(title)}</div>
          <div class="new-release-sub">${escapeHtml(sub)}</div>
        </div>
      `;

      els.newRelease.querySelector('.new-release-card').addEventListener('click', () => {
        if (latestTrack.album) {
          window.PocuAlbumUI?.open?.(artist.name, latestTrack.album);
        } else {
          window.PocuTrackUI?.open?.(latestTrack.id);
        }
      });
    }

    // 3. Дискография (Альбомы + Все треки)
    const albumsMap = new Map();
    tracks.forEach(t => {
      if (t.album) {
        if (!albumsMap.has(t.album)) albumsMap.set(t.album, t);
      }
    });

    if (albumsMap.size > 0) {
      els.albumsSection.style.display = '';
      els.albumsRow.replaceChildren();
      albumsMap.forEach((track, albumName) => {
        const tile = document.createElement('button');
        tile.className = 'home-tile';
        tile.innerHTML = `
          <div class="home-tile-art-wrap">
            <div class="home-tile-art" style="background-image:url('${track.artwork || ''}')"></div>
          </div>
          <div class="home-tile-info">
            <div class="home-tile-text">
              <div class="home-tile-name">${escapeHtml(albumName)}</div>
              <div class="home-tile-artist">Альбом</div>
            </div>
          </div>
        `;
        tile.addEventListener('click', () => window.PocuAlbumUI?.open?.(artist.name, albumName));
        els.albumsRow.appendChild(tile);
      });
    } else {
      els.albumsSection.style.display = 'none';
    }

    if (tracks.length > 0) {
      els.tracksSection.style.display = '';
      els.tracksRow.replaceChildren();
      tracks.forEach(t => {
        const tile = document.createElement('button');
        tile.className = 'home-tile';
        tile.innerHTML = `
          <div class="home-tile-art-wrap">
            <div class="home-tile-art" style="background-image:url('${t.artwork || ''}')"></div>
          </div>
          <div class="home-tile-info">
            <div class="home-tile-text">
              <div class="home-tile-name">${escapeHtml(t.title)}</div>
              <div class="home-tile-artist">Трек</div>
            </div>
          </div>
        `;
        tile.addEventListener('click', () => window.PocuTrackUI?.open?.(t.id));
        els.tracksRow.appendChild(tile);
      });
    } else {
      els.tracksSection.style.display = 'none';
    }

    PocuTrackCard.syncPlaying(els.tracks, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts(els.tracks, window.PocuStore.favorites.all());
  }

  function openAllTracks(artist, tracks) {
    els.allName.textContent = artist.name;
    els.allInfo.textContent = `Все треки • ${tracks.length}`;
    els.allList.replaceChildren();

    const frag = document.createDocumentFragment();
    tracks.forEach((track, i) => {
      frag.appendChild(PocuTrackCard.create(track, {
        index: i,
        onPlay: () => window.PocuPlayer.playQueue(tracks, i)
      }));
    });
    els.allList.appendChild(frag);

    PocuTrackCard.syncPlaying(els.allList, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts(els.allList, window.PocuStore.favorites.all());

    window.PocuLayers?.front?.(els.allScreen);
    els.allScreen.classList.add('open');
    els.allScreen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('playlist-open');
    requestAnimationFrame(() => { els.allScreen.scrollTop = 0; });
  }

  /* === Контекст-меню [...] === */
  function ensureArtistMenu() {
    if (document.getElementById('artistContextOverlay')) return;
    artistMenuOverlay = document.createElement('div');
    artistMenuOverlay.className = 'context-overlay';
    artistMenuOverlay.id = 'artistContextOverlay';
    artistMenu = document.createElement('div');
    artistMenu.className = 'context-menu';
    artistMenu.setAttribute('role', 'menu');
    artistMenuOverlay.appendChild(artistMenu);
    document.body.appendChild(artistMenuOverlay);

    artistMenuOverlay.addEventListener('click', e => {
      if (e.target === artistMenuOverlay) closeArtistMenu();
    });
  }

  function openArtistMenu(anchor, artist) {
    const isFav = window.PocuStore.favoriteArtists.has(artist.id);
    const items = [
      { action: 'fav', label: isFav ? 'Убрать из избранного' : 'В избранное' },
      { action: 'share', label: 'Поделиться' }
    ];

    artistMenu.innerHTML = items.map(it => `
      <button class="context-item" data-action="${it.action}">
        <span class="context-label">${escapeHtml(it.label)}</span>
      </button>
    `).join('');

    artistMenu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.action;
        closeArtistMenu();
        if (a === 'fav') {
          const now = window.PocuStore.favoriteArtists.toggle(artist.id);
          window.PocuSupabase?.syncFavoriteArtist?.(artist.id, now);
          // Перерисовываем шапку, чтобы сердечко обновилось
          renderActions(artist, window.PocuArtists.tracksFor(artist.id));
        } else if (a === 'share') {
          const url = window.PocuRouter?.build?.('artist', artist.id) || location.href;
          const text = `Артист ${artist.name} в Pocu Music`;
          if (window.PocuShare?.share) window.PocuShare.share(url, artist.name, text);
          else if (navigator.share) navigator.share({ title: artist.name, text, url }).catch(() => {});
        }
      });
    });

    artistMenuOverlay.classList.add('open');
    
    // Позиционирование
    const rect = artistMenu.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    let left = a.right - rect.width;
    if (left < 16) left = 16;
    if (left + rect.width > window.innerWidth - 16) left = window.innerWidth - rect.width - 16;

    let top = a.bottom + 6;
    if (top + rect.height > window.innerHeight - 16) {
      top = a.top - rect.height - 6;
      if (top < 16) top = 16;
    }
    artistMenu.style.left = left + 'px';
    artistMenu.style.top = top + 'px';
  }

  function closeArtistMenu() {
    artistMenuOverlay?.classList.remove('open');
  }

  function closeArtist() {
    currentArtistId = null;
    window.PocuRouter?.clearHash?.();
    window.PocuLayers?.reset?.(els.screen);
    els.screen.classList.remove('open');
    els.screen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('artist-open');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  return {
    init, openArtist, closeArtist,
    isArtistFavorite: id => window.PocuStore.favoriteArtists.has(id),
    toggleArtistFavorite: id => window.PocuStore.favoriteArtists.toggle(id),
    listFavoriteArtists: () => window.PocuStore.favoriteArtists.all()
  };
})();