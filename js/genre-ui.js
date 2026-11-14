/* Pocu Music — экран жанра (подборка) */
window.PocuGenreUI = (() => {
  let els = {};
  let initialized = false;
  let currentGenre = null;

  const GENRE_GRADS = [
    'linear-gradient(135deg, #7c5cff, #3884ff)',
    'linear-gradient(135deg, #ff409e, #7c5cff)',
    'linear-gradient(135deg, #3884ff, #ff409e)',
    'linear-gradient(135deg, #a78bfa, #ff409e)',
    'linear-gradient(135deg, #6aa8ff, #a78bfa)',
    'linear-gradient(135deg, #ff6b9f, #ffd23f)',
    'linear-gradient(135deg, #30cfd0, #330867)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)'
  ];

  function genreGradient(genre) {
    let h = 0;
    for (let i = 0; i < genre.length; i++) h = (h * 31 + genre.charCodeAt(i)) >>> 0;
    return GENRE_GRADS[h % GENRE_GRADS.length];
  }

  function init() {
    if (initialized) return;
    initialized = true;

    const screen = document.createElement('div');
    screen.className = 'genre-overlay';
    screen.id = 'genreScreen';
    screen.setAttribute('aria-hidden', 'true');
    screen.innerHTML = `
      <div class="genre-overlay-inner">
        <button class="back-btn" id="genreBackBtn" aria-label="Назад">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          <span>Назад</span>
        </button>
        <div class="genre-hero" id="genreHero">
          <div class="genre-hero-name" id="genreHeroName"></div>
          <div class="genre-hero-sub" id="genreHeroSub"></div>
        </div>
        <div class="playlist-actions" id="genreActions"></div>
        <div class="genre-tracks" id="genreTracks"></div>
      </div>
    `;
    document.body.appendChild(screen);

    els = {
      screen, back: screen.querySelector('#genreBackBtn'),
      hero: screen.querySelector('#genreHero'),
      name: screen.querySelector('#genreHeroName'),
      sub:  screen.querySelector('#genreHeroSub'),
      actions: screen.querySelector('#genreActions'),
      tracks:  screen.querySelector('#genreTracks')
    };

    els.back.addEventListener('click', close);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && currentGenre) close();
    });

    window.PocuPlayer.subscribe(state => {
      if (currentGenre) PocuTrackCard.syncPlaying(els.tracks, state);
    });

    window.PocuStore.subscribe(state => {
      if (currentGenre) PocuTrackCard.syncHearts(els.tracks, state.favorites);
    });
  }

  function open(genre) {
    if (!initialized) init();
    if (!genre) return;

    const tracks = window.PocuLibrary.all().filter(t => t.genre === genre && t.preview);
    if (!tracks.length) return;

    currentGenre = genre;

    els.hero.style.background = genreGradient(genre);
    els.name.textContent = genre;
    els.sub.textContent = `${tracks.length} ${plural(tracks.length)}`;

    els.actions.replaceChildren();
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

    els.actions.append(playAll, shuffleBtn);

    els.tracks.replaceChildren();
    const frag = document.createDocumentFragment();
    tracks.forEach((t, i) => {
      frag.appendChild(PocuTrackCard.create(t, {
        index: i,
        onPlay: () => window.PocuPlayer.playQueue(tracks, i)
      }));
    });
    els.tracks.appendChild(frag);

    document.querySelectorAll('.playlist-overlay, .artist-overlay, .track-overlay, .album-overlay, .genre-overlay')
      .forEach(el => { if (el !== els.screen) el.style.zIndex = ''; });
    els.screen.style.zIndex = '84';

    els.screen.classList.add('open');
    els.screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('genre-open');
    requestAnimationFrame(() => { els.screen.scrollTop = 0; });

    PocuTrackCard.syncPlaying(els.tracks, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts(els.tracks, window.PocuStore.favorites.all());
  }

  function close() {
    if (!els.screen) return;
    currentGenre = null;
    els.screen.classList.remove('open');
    els.screen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('genre-open');
  }

  function plural(n) {
    const m = n % 100;
    if (m >= 11 && m <= 14) return 'треков';
    const l = n % 10;
    if (l === 1) return 'трек';
    if (l >= 2 && l <= 4) return 'трека';
    return 'треков';
  }

  return { init, open, close };
})();