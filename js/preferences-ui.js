/* Pocu Music — Уточнить предпочтения (sheet) */
window.PocuPreferencesUI = (() => {
  let els = {};
  let initialized = false;
  let selectedGenres = new Set();
  let selectedArtists = new Set();

  function init() {
    if (initialized) return;
    initialized = true;

    const sheet = document.createElement('div');
    sheet.className = 'sheet-overlay';
    sheet.id = 'sheet-prefs';
    sheet.innerHTML = `
      <div class="sheet-panel sheet-panel--tall">
        <div class="sheet-header"><h2>Уточнить предпочтения</h2></div>
        <div class="sheet-body sheet-body--scroll">
          <div class="prefs-subhead">Жанры</div>
          <div class="prefs-chips" id="prefsGenres"></div>
          <div class="prefs-subhead">Артисты</div>
          <div class="prefs-list" id="prefsArtists"></div>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-secondary" id="prefsClear">Сбросить</button>
          <button class="btn btn-primary" id="prefsSave">Сохранить</button>
        </div>
      </div>
    `;
    document.body.appendChild(sheet);

    els = {
      sheet,
      genres: sheet.querySelector('#prefsGenres'),
      artists: sheet.querySelector('#prefsArtists'),
      clear: sheet.querySelector('#prefsClear'),
      save: sheet.querySelector('#prefsSave')
    };

    els.save.addEventListener('click', save);
    els.clear.addEventListener('click', () => {
      selectedGenres.clear();
      selectedArtists.clear();
      renderGenres();
      renderArtists();
    });
    els.sheet.addEventListener('click', e => { if (e.target === els.sheet) close(); });
  }

  function renderGenres() {
    const lib = window.PocuLibrary.all();
    const genres = [...new Set(lib.map(t => t.genre).filter(Boolean))].sort();
    els.genres.replaceChildren();
    genres.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (selectedGenres.has(g) ? ' chip-active' : '');
      b.textContent = g;
      b.addEventListener('click', () => {
        if (selectedGenres.has(g)) selectedGenres.delete(g);
        else selectedGenres.add(g);
        b.classList.toggle('chip-active');
      });
      els.genres.appendChild(b);
    });
  }

  function renderArtists() {
    const lib = window.PocuLibrary.all();
    const counts = new Map();
    lib.forEach(t => { if (t.artist) counts.set(t.artist, (counts.get(t.artist) || 0) + 1); });
    const artists = [...counts.entries()].sort((a,b) => b[1]-a[1]).map(x => x[0]);

    els.artists.replaceChildren();
    artists.forEach(a => {
      const label = document.createElement('label');
      label.className = 'prefs-artist-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selectedArtists.has(a);
      cb.addEventListener('change', () => {
        if (cb.checked) selectedArtists.add(a);
        else selectedArtists.delete(a);
      });

      const name = document.createElement('span');
      name.textContent = a;

      const cnt = document.createElement('span');
      cnt.className = 'prefs-artist-count';
      cnt.textContent = String(counts.get(a));

      label.append(cb, name, cnt);
      els.artists.appendChild(label);
    });
  }

  function open() {
    if (!initialized) init();
    const prefs = window.PocuStore.preferences.get();
    selectedGenres = new Set(prefs.genres);
    selectedArtists = new Set(prefs.artists);
    renderGenres();
    renderArtists();
    els.sheet.classList.add('open');
  }

  function save() {
    window.PocuStore.preferences.set({
      genres: [...selectedGenres],
      artists: [...selectedArtists]
    });
    close();
  }

  function close() { els.sheet.classList.remove('open'); }

  return { init, open };
})();