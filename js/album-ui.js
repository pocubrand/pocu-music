/* Pocu Music — страница альбома (entity layout) */
window.PocuAlbumUI = (() => {
  let els = {};
  let initialized = false;
  let currentArtist = null;
  let currentAlbum  = null;
  let currentTracks = [];
  let updatePlayBtnRef = null;

  function init() {
    if (initialized) return;
    initialized = true;

    const screen = document.createElement('div');
    screen.className = 'album-overlay';
    screen.id = 'albumScreen';
    screen.setAttribute('aria-hidden', 'true');
    screen.innerHTML = `
      <div class="album-overlay-inner entity-page">
        <div class="entity-header">
          <button class="back-btn entity-back" id="albumBackBtn" aria-label="Назад">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Назад</span>
          </button>
          <div class="entity-cover-wrap">
            <img class="entity-cover" id="albumArt" alt="">
          </div>
          <div class="entity-meta">
            <div class="entity-type">Альбом</div>
            <h1 class="entity-title" id="albumTitle">—</h1>
            <div class="entity-sub" id="albumArtist">—</div>
            <div class="entity-info" id="albumInfo"></div>
            <div class="entity-actions" id="albumActions"></div>
          </div>
        </div>
        <div class="entity-tracks" id="albumTracks"></div>
      </div>
    `;
    document.body.appendChild(screen);

    els = {
      screen:  screen,
      back:    screen.querySelector('#albumBackBtn'),
      art:     screen.querySelector('#albumArt'),
      title:   screen.querySelector('#albumTitle'),
      artist:  screen.querySelector('#albumArtist'),
      info:    screen.querySelector('#albumInfo'),
      actions: screen.querySelector('#albumActions'),
      tracks:  screen.querySelector('#albumTracks')
    };

    els.back.addEventListener('click', closeAlbum);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && currentAlbum) closeAlbum();
    });

    window.PocuPlayer.subscribe(state => {
      if (!currentAlbum) return;
      PocuTrackCard.syncPlaying(els.tracks, state);
      updatePlayBtnRef?.();
    });

    window.PocuStore.subscribe(state => {
      if (!currentAlbum) return;
      PocuTrackCard.syncHearts(els.tracks, state.favorites);
    });
  }

  function open(artist, album) {
    if (!initialized) init();
    if (!album) return;

    const tracks = window.PocuLibrary.tracksForAlbum(artist, album);
    if (!tracks.length) return;

    currentArtist = artist;
    currentAlbum  = album;
    currentTracks = tracks;
    window.PocuRouter?.setHash?.('album', artist, album);

    /* --- Обложка --- */
    const firstWithArt = tracks.find(t => t.artwork);
    if (firstWithArt) {
      els.art.src = firstWithArt.artwork;
      els.art.style.visibility = '';
    } else {
      els.art.removeAttribute('src');
      els.art.style.visibility = 'hidden';
    }

    /* --- Заголовок --- */
    els.title.textContent = album;

    /* --- Артист (кликабельные имена из первого трека) --- */
    if (window.PocuArtists?.renderInline) {
      window.PocuArtists.renderInline(els.artist, tracks[0]);
    } else {
      els.artist.textContent = artist;
    }

    /* --- Инфо: N треков • X мин. --- */
    const totalSec = tracks.reduce((s, t) => s + (t.duration || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    const infoParts = [`${tracks.length} ${plural(tracks.length)}`];
    if (totalMin > 0) infoParts.push(`${totalMin} мин.`);
    els.info.textContent = infoParts.join(' • ');

    renderActions(artist, album, tracks);
    renderTracks(tracks);

    window.PocuLayers?.front?.(els.screen);

    els.screen.classList.add('open');
    els.screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('album-open');

    requestAnimationFrame(() => {
      const inner = els.screen.querySelector('.album-overlay-inner');
      if (inner) inner.scrollTop = 0;
    });
  }

  function renderActions(artist, album, tracks) {
    els.actions.replaceChildren();
    if (!tracks.length) { updatePlayBtnRef = null; return; }

    /* 1. Играть всё / Пауза / Продолжить */
    const playAll = document.createElement('button');
    playAll.className = 'btn btn-primary';
    playAll.id = 'alPlayAll';
    els.actions.appendChild(playAll);

    const updatePlayBtn = () => {
      const cur = window.PocuPlayer.current;
      const isAlbum = cur && tracks.some(t => t.id === cur.id);
      const playing = isAlbum && window.PocuPlayer.getState().playing;
      playAll.textContent = isAlbum
        ? (playing ? 'Пауза' : 'Продолжить')
        : 'Играть всё';
    };
    updatePlayBtnRef = updatePlayBtn;
    updatePlayBtn();

    playAll.addEventListener('click', () => {
      const cur = window.PocuPlayer.current;
      const isAlbum = cur && tracks.some(t => t.id === cur.id);
      if (isAlbum) {
        window.PocuPlayer.togglePlay();
      } else {
        window.PocuPlayer.playQueue(tracks, 0);
      }
    });

    /* 2. Перемешать */
    const shuffleBtn = document.createElement('button');
    shuffleBtn.className = 'btn btn-secondary';
    shuffleBtn.textContent = 'Перемешать';
    shuffleBtn.addEventListener('click', () => {
      const s = [...tracks].sort(() => Math.random() - 0.5);
      window.PocuPlayer.playQueue(s, 0);
    });
    els.actions.appendChild(shuffleBtn);

    /* 3. Сердечко */
    const heart = document.createElement('button');
    heart.type = 'button';
    heart.className = 'fav-heart';
    heart.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20.2s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.2 2.7c0 4.9-7.2 9.3-7.2 9.3z"/>
      </svg>`;

    const updateHeart = () => {
      const has = window.PocuStore.favoriteAlbums.has(artist, album);
      heart.classList.toggle('active', has);
      heart.setAttribute('aria-label', has ? 'Убрать из избранного' : 'В избранное');
    };
    updateHeart();

    heart.addEventListener('click', () => {
      const now = window.PocuStore.favoriteAlbums.toggle(artist, album);
      updateHeart();
      window.PocuSupabase?.syncFavoriteAlbum?.(artist, album, now);
      if (now) {
        heart.classList.add('just-activated');
        setTimeout(() => heart.classList.remove('just-activated'), 450);
      }
      document.dispatchEvent(new CustomEvent('album:favorites-change', {
        detail: { artist, album, active: now }
      }));
    });

    els.actions.appendChild(heart);
  }

  function renderTracks(tracks) {
    els.tracks.replaceChildren();
    if (!tracks.length) {
      els.tracks.innerHTML = `<div class="state-block"><div class="state-title">Пока нет треков</div></div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    tracks.forEach((t, i) => {
      frag.appendChild(PocuTrackCard.create(t, {
        index: i,
        disableOpen: true,
        onPlay: () => window.PocuPlayer.playQueue(tracks, i)
      }));
    });
    els.tracks.appendChild(frag);

    PocuTrackCard.syncPlaying(els.tracks, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts(els.tracks, window.PocuStore.favorites.all());
  }

  function closeAlbum() {
    if (!els.screen) return;
    currentArtist = null;
    currentAlbum = null;
    currentTracks = [];
    updatePlayBtnRef = null;
    window.PocuRouter?.clearHash?.();
    window.PocuLayers?.reset?.(els.screen);
    els.screen.classList.remove('open');
    els.screen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('album-open');
  }

  function plural(n) {
    const m = n % 100;
    if (m >= 11 && m <= 14) return 'треков';
    const l = n % 10;
    if (l === 1) return 'трек';
    if (l >= 2 && l <= 4) return 'трека';
    return 'треков';
  }

  return {
    init, open, closeAlbum,
    isFavorite: (a, al) => window.PocuStore.favoriteAlbums.has(a, al),
    toggleFavorite: (a, al) => window.PocuStore.favoriteAlbums.toggle(a, al),
    listFavoriteAlbums: () => window.PocuStore.favoriteAlbums.list()
  };
})();