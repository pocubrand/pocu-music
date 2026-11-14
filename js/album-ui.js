/* Pocu Music — страница альбома */
window.PocuAlbumUI = (() => {
  let els = {};
  let initialized = false;
  let currentArtist = null;
  let currentAlbum  = null;

  const GRADIENT = 'linear-gradient(135deg, rgba(124,92,255,.6), rgba(255,64,158,.4) 55%, rgba(56,132,255,.5))';

  function init() {
    if (initialized) return;
    initialized = true;

    const screen = document.createElement('div');
    screen.className = 'album-overlay';
    screen.id = 'albumScreen';
    screen.setAttribute('aria-hidden', 'true');
    screen.innerHTML = `
      <div class="album-overlay-inner">
        <button class="back-btn" id="albumBackBtn" aria-label="Назад">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          <span>Назад</span>
        </button>
        <div class="album-hero">
          <div class="album-art" id="albumArt"></div>
          <h1 class="album-title" id="albumTitle"></h1>
          <div class="album-artist" id="albumArtist"></div>
          <div class="album-actions" id="albumActions"></div>
        </div>
        <div class="album-tracks" id="albumTracks"></div>
      </div>
    `;
    document.body.appendChild(screen);

    els = {
      screen, back:    screen.querySelector('#albumBackBtn'),
      art:     screen.querySelector('#albumArt'),
      title:   screen.querySelector('#albumTitle'),
      artist:  screen.querySelector('#albumArtist'),
      actions: screen.querySelector('#albumActions'),
      tracks:  screen.querySelector('#albumTracks')
    };

    els.back.addEventListener('click', closeAlbum);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && currentAlbum) closeAlbum();
    });

    window.PocuPlayer.subscribe(state => {
      if (currentAlbum) PocuTrackCard.syncPlaying(els.tracks, state);
    });

    window.PocuStore.subscribe(state => {
      if (currentAlbum) PocuTrackCard.syncHearts(els.tracks, state.favorites);
    });
  }

  function open(artist, album) {
    if (!initialized) init();
    if (!album) return;

    const tracks = window.PocuLibrary.tracksForAlbum(artist, album);
    if (!tracks.length) return;

    currentArtist = artist;
    currentAlbum  = album;
    window.PocuRouter?.setHash?.('album', artist, album);

    const firstWithArt = tracks.find(t => t.artwork);
    if (firstWithArt) {
      els.art.style.backgroundImage = `url("${firstWithArt.artwork}")`;
      els.art.classList.remove('album-art--placeholder');
      els.art.textContent = '';
    } else {
      els.art.style.backgroundImage = GRADIENT;
      els.art.classList.add('album-art--placeholder');
      els.art.textContent = album.slice(0, 1).toUpperCase();
    }

    els.title.textContent = album;
    els.artist.textContent = `${artist} · ${tracks.length} ${plural(tracks.length)}`;

    renderActions(artist, album, tracks);
    renderTracks(tracks);

    document.querySelectorAll('.playlist-overlay, .artist-overlay, .track-overlay, .album-overlay')
      .forEach(el => { if (el !== els.screen) el.style.zIndex = ''; });
    els.screen.style.zIndex = '83';

    els.screen.classList.add('open');
    els.screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('album-open');
    requestAnimationFrame(() => { els.screen.scrollTop = 0; });
  }

  function renderActions(artist, album, tracks) {
    els.actions.replaceChildren();
    if (!tracks.length) return;

    const playAll = document.createElement('button');
    playAll.className = 'btn btn-primary';
    playAll.textContent = 'Играть всё';
    playAll.addEventListener('click', () => window.PocuPlayer.playQueue(tracks, 0));

    const shuffleBtn = document.createElement('button');
    shuffleBtn.className = 'btn btn-secondary';
    shuffleBtn.textContent = 'Перемешать';
    shuffleBtn.addEventListener('click', () => {
      const s = [...tracks].sort(() => Math.random() - 0.5);
      window.PocuPlayer.playQueue(s, 0);
    });

    const heart = document.createElement('button');
    heart.type = 'button';
    heart.className = 'fav-heart';
    heart.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20.2s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.2 2.7c0 4.9-7.2 9.3-7.2 9.3z"/>
      </svg>`;

    const update = () => {
      const has = window.PocuStore.favoriteAlbums.has(artist, album);
      heart.classList.toggle('active', has);
      heart.setAttribute('aria-label', has ? 'Убрать из избранного' : 'В избранное');
    };
    update();

    heart.addEventListener('click', () => {
      const now = window.PocuStore.favoriteAlbums.toggle(artist, album);
      update();
      window.PocuSupabase?.syncFavoriteAlbum?.(artist, album, now);
      if (now) {
        heart.classList.add('just-activated');
        setTimeout(() => heart.classList.remove('just-activated'), 450);
      }
      document.dispatchEvent(new CustomEvent('album:favorites-change', {
        detail: { artist, album, active: now }
      }));
    });

    els.actions.append(playAll, shuffleBtn, heart);
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
    window.PocuRouter?.clearHash?.();
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