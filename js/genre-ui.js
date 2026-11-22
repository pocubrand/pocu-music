/* Pocu Music — экран жанра (подборка, entity layout) */
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
      <div class="genre-overlay-inner entity-page">
        <div class="entity-header">
          <button class="back-btn entity-back" id="genreBackBtn" aria-label="Назад">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Назад</span>
          </button>
          <div class="entity-cover-wrap">
            <div class="entity-cover" id="genreCover"></div>
          </div>
          <div class="entity-meta">
            <div class="entity-type">Подборка</div>
            <h1 class="entity-title" id="genreName">—</h1>
            <div class="entity-sub" id="genreSub"></div>
            <div class="entity-info" id="genreInfo"></div>
            <div class="entity-actions" id="genreActions"></div>
          </div>
        </div>
        <div class="entity-tracks" id="genreTracks"></div>
      </div>
    `;
    document.body.appendChild(screen);

    els = {
      screen:  screen,
      back:    screen.querySelector('#genreBackBtn'),
      cover:   screen.querySelector('#genreCover'),
      name:    screen.querySelector('#genreName'),
      sub:     screen.querySelector('#genreSub'),
      info:    screen.querySelector('#genreInfo'),
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

    /* Закрываем оверлей при клике на табы сайдбара (capture = до app.js) */
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tab-item, #sidebarSettingsBtn')) return;
      if (currentGenre) close();
    }, true);
  }

  function open(genre) {
    if (!initialized) init();
    if (!genre) return;

    const tracks = window.PocuLibrary.all().filter(t => t.genre === genre && t.preview);
    if (!tracks.length) return;

    currentGenre = genre;

    /* Обложка — градиент + инициал */
    els.cover.style.background = genreGradient(genre);
    els.cover.textContent = (genre || '?').slice(0, 1).toUpperCase();

    /* Заголовок / подпись / инфо */
    els.name.textContent = genre;
    els.sub.textContent = `${tracks.length} ${plural(tracks.length)}`;

    const totalSec = tracks.reduce((s, t) => s + (t.duration || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    const infoParts = [];
    if (totalMin > 0) infoParts.push(`${totalMin} мин.`);
    els.info.textContent = infoParts.join(' • ');

    /* Кнопки */
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

    /* Треки */
    els.tracks.replaceChildren();
    const frag = document.createDocumentFragment();
    tracks.forEach((t, i) => {
      frag.appendChild(PocuTrackCard.create(t, {
        index: i,
        onPlay: () => window.PocuPlayer.playQueue(tracks, i)
      }));
    });
    els.tracks.appendChild(frag);

    window.PocuLayers?.front?.(els.screen);

    els.screen.classList.add('open');
    els.screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('genre-open');

    requestAnimationFrame(() => {
      const inner = els.screen.querySelector('.genre-overlay-inner');
      if (inner) inner.scrollTop = 0;
    });

    PocuTrackCard.syncPlaying(els.tracks, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts(els.tracks, window.PocuStore.favorites.all());
  }

  function close() {
    if (!els.screen) return;
    currentGenre = null;
    window.PocuLayers?.reset?.(els.screen);
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