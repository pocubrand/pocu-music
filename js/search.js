/* Pocu Music — поиск треков + артистов */
window.PocuSearch = (() => {
  let els = {};
  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    els = {
      form:        document.getElementById('searchForm'),
      input:       document.getElementById('searchInput'),
      clear:       document.getElementById('clearBtn'),
      initial:     document.getElementById('searchInitial'),
      artistsBlock:document.getElementById('searchArtists'),
      artistsList: document.getElementById('searchArtistsList'),
      results:     document.getElementById('results')
    };

    if (!els.input) return;

    const handler = debounce(handleInput, 120);
    els.input.addEventListener('input', handler);

    els.clear?.addEventListener('click', () => {
      els.input.value = '';
      handleInput();
      els.input.focus();
    });
  }

  function handleInput() {
    const q = els.input.value.trim();
    els.clear.hidden = !q;

    if (!q) {
      els.initial.hidden = false;
      els.artistsBlock.hidden = true;
      els.results.innerHTML = '';
      return;
    }

    els.initial.hidden = true;
    renderArtists(q);
    renderTracks(q);
  }

  /* ---------- Артисты ---------- */
  function renderArtists(q) {
    const lower = q.toLowerCase();
    const lib = window.PocuLibrary.all();

    // Собираем всех уникальных артистов из библиотеки
    const artistMap = new Map();
    lib.forEach(t => {
      const parts = window.PocuArtists.splitArtists(t.artist);
      parts.forEach(name => {
        if (!artistMap.has(name)) artistMap.set(name, []);
        artistMap.get(name).push(t);
      });
    });

    // Матчим: имя артиста ИЛИ любой трек этого артиста содержит запрос
    const matches = [];
    for (const [name, tracks] of artistMap.entries()) {
      const nameMatch  = name.includes(lower);
      const trackMatch = tracks.some(t => t.title.toLowerCase().includes(lower));
      if (!nameMatch && !trackMatch) continue;

      const pocu = window.PocuArtists.get(name);
      matches.push({
        id: pocu?.id || name,
        name: pocu?.name || capitalize(name),
        photo: pocu?.photo || tracks.find(t => t.artwork)?.artwork || ''
      });
    }

    // Pocu-артисты вперёд
    matches.sort((a, b) => {
      const aF = window.PocuArtists.get(a.id) ? 0 : 1;
      const bF = window.PocuArtists.get(b.id) ? 0 : 1;
      return aF - bF;
    });

    if (!matches.length) {
      els.artistsBlock.hidden = true;
      return;
    }

    els.artistsBlock.hidden = false;
    els.artistsList.replaceChildren();
    matches.slice(0, 8).forEach(a => {
      els.artistsList.appendChild(createArtistTile(a));
    });
  }

  function createArtistTile(a) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'home-tile';

    const artWrap = document.createElement('div');
    artWrap.className = 'home-tile-art-wrap home-tile-art-wrap--round';

    const art = document.createElement('div');
    art.className = 'home-tile-art home-tile-art--round';
    if (a.photo) art.style.backgroundImage = `url("${a.photo}")`;
    else {
      art.classList.add('home-tile-art--placeholder');
      art.textContent = a.name.slice(0, 1).toUpperCase();
    }
    artWrap.appendChild(art);

    const info = document.createElement('div');
    info.className = 'home-tile-info';
    const text = document.createElement('div');
    text.className = 'home-tile-text';

    const name = document.createElement('div');
    name.className = 'home-tile-name';
    name.textContent = a.name;

    const sub = document.createElement('div');
    sub.className = 'home-tile-artist';
    sub.textContent = 'Артист';

    text.append(name, sub);
    info.appendChild(text);
    tile.append(artWrap, info);
    tile.addEventListener('click', () => window.PocuArtistUI?.openArtist?.(a.id));
    return tile;
  }

  /* ---------- Треки ---------- */
  function renderTracks(q) {
    const tracks = window.PocuLibrary.search(q);
    els.results.replaceChildren();

    if (!tracks.length) {
      els.results.innerHTML = `<div class="state-block"><div class="state-title">Ничего не найдено</div><div class="state-sub">Попробуй другое название</div></div>`;
      return;
    }

    tracks.forEach((track, i) => {
      els.results.appendChild(PocuTrackCard.create(track, {
        index: i,
        onPlay: () => window.PocuPlayer.playQueue(tracks, i)
      }));
    });
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return { init };
})();