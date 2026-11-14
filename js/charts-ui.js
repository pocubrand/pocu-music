/* Pocu Music — экран «Чарты» */
window.PocuChartsUI = (() => {
  let els = {};
  let initialized = false;

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

    els = {
      genresGrid: document.getElementById('chartsGenres'),
      chartList:  document.getElementById('chartsTopList'),
      chartEmpty: document.getElementById('chartsTopEmpty'),
      newList:    document.getElementById('chartsNewList'),
      newEmpty:   document.getElementById('chartsNewEmpty')
    };

    renderGenres();
    loadChart();
    loadNew();

    document.addEventListener('pocu:auth', () => loadChart());

    // Синхронизация сердечек чарта при любых изменениях избранного
    // (клик по сердечку, контекстное меню, синк из облака и т.д.)
    if (window.PocuStore) {
      window.PocuStore.subscribe(state => {
        if (els.chartList) {
          window.PocuTrackCard?.syncHearts?.(els.chartList, state.favorites);
        }
      });
    }
  }

  /* ---------- Подборки: тайлы как на Главной ---------- */
  function renderGenres() {
    if (!els.genresGrid) return;
    const lib = window.PocuLibrary.all();
    const counts = new Map();
    lib.forEach(t => { if (t.genre && t.preview) counts.set(t.genre, (counts.get(t.genre) || 0) + 1); });

    const genres = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    els.genresGrid.replaceChildren();
    if (!genres.length) return;

    genres.forEach(([genre, count]) => {
      els.genresGrid.appendChild(createGenreTile(genre, count));
    });
  }

  function createGenreTile(genre, count) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'home-tile';

    const artWrap = document.createElement('div');
    artWrap.className = 'home-tile-art-wrap';

    const art = document.createElement('div');
    art.className = 'home-tile-art genre-art';
    art.style.background = genreGradient(genre);

    const artContent = document.createElement('div');
    artContent.className = 'genre-art-content';
    artContent.innerHTML = `
      <div class="genre-art-name">${escapeHtml(genre)}</div>
      <div class="genre-art-count">${count} ${plural(count)}</div>
    `;
    art.appendChild(artContent);
    artWrap.appendChild(art);

    tile.appendChild(artWrap);
    tile.addEventListener('click', () => window.PocuGenreUI?.open?.(genre));
    return tile;
  }

  function plural(n) {
    const m = n % 100;
    if (m >= 11 && m <= 14) return 'треков';
    const l = n % 10;
    if (l === 1) return 'трек';
    if (l >= 2 && l <= 4) return 'трека';
    return 'треков';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  /* ---------- Чарт недели ---------- */
  async function loadChart() {
    if (!els.chartList) return;
    let items = [];
    try {
      const cloud = await window.PocuSupabase?.fetchTopTracks?.(7, 15);
      if (cloud && cloud.length) {
        items = cloud.map(x => ({ track: window.PocuLibrary.get(x.trackId), plays: x.plays })).filter(x => x.track);
      }
    } catch (e) { console.warn('[charts] loadChart:', e); }

    if (!items.length) {
      const stats = window.PocuStore.skipStats.all();
      items = Object.entries(stats)
        .filter(([, s]) => s.plays > 0)
        .sort((a, b) => b[1].plays - a[1].plays)
        .slice(0, 15)
        .map(([id, s]) => ({ track: window.PocuLibrary.get(id), plays: s.plays }))
        .filter(x => x.track);
    }

    if (!items.length) {
      els.chartList.hidden = true;
      els.chartEmpty.hidden = false;
      return;
    }

    els.chartEmpty.hidden = true;
    els.chartList.hidden = false;
    els.chartList.replaceChildren();

    const tracks = items.map(x => x.track);
    items.forEach((x, i) => {
      const row = document.createElement('div');
      row.className = 'chart-row';

      const pos = document.createElement('div');
      pos.className = 'chart-position';
      pos.textContent = String(i + 1);

      const card = PocuTrackCard.create(x.track, {
        index: i,
        onPlay: () => window.PocuPlayer.playQueue(tracks, i)
      });

      row.append(pos, card);
      els.chartList.appendChild(row);
    });

    // После рендера — синхронизируем сердечки с актуальным избранным
    window.PocuTrackCard?.syncHearts?.(els.chartList, window.PocuStore.favorites.all());
  }

  /* ---------- Новинки ---------- */
  async function loadNew() {
    if (!els.newList) return;
    let items = [];
    try {
      const cloud = await window.PocuSupabase?.fetchNewTracks?.(30, 15);
      if (cloud && cloud.length) items = cloud.map(x => window.PocuLibrary.get(x.trackId)).filter(Boolean);
    } catch (e) { console.warn('[charts] loadNew:', e); }
    if (!items.length) items = window.PocuLibrary.all().slice(-15).reverse();
    if (!items.length) { els.newList.hidden = true; els.newEmpty.hidden = false; return; }
    els.newEmpty.hidden = true;
    els.newList.hidden = false;
    els.newList.replaceChildren();
    items.forEach(track => els.newList.appendChild(createNoveltyTile(track, items)));
  }

  function createNoveltyTile(track, list) {
    const el = document.createElement('div');
    el.className = 'home-tile';
    el.dataset.id = track.id;

    const artWrap = document.createElement('div');
    artWrap.className = 'home-tile-art-wrap';

    const art = document.createElement('div');
    art.className = 'home-tile-art';
    if (track.artwork) art.style.backgroundImage = `url("${track.artwork}")`;

    const overlay = document.createElement('div');
    overlay.className = 'home-tile-play-overlay';
    overlay.innerHTML = `
      <svg class="icon-play"  viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>`;
    artWrap.append(art, overlay);

    const info = document.createElement('div');
    info.className = 'home-tile-info';
    const text = document.createElement('div');
    text.className = 'home-tile-text';

    const name = document.createElement('div');
    name.className = 'home-tile-name';
    name.textContent = track.title;

    const artist = document.createElement('div');
    artist.className = 'home-tile-artist';
    artist.textContent = track.artist;

    text.append(name, artist);
    info.appendChild(text);
    el.append(artWrap, info);
    el.addEventListener('click', () => {
      const idx = list.findIndex(t => t.id === track.id);
      if (idx >= 0) window.PocuPlayer.playQueue(list, idx);
    });
    return el;
  }

  return { init };
})();