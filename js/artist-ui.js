/* Pocu Music — экран артиста + избранные артисты */
window.PocuArtistUI = (() => {
  let els = {};
  let initialized = false;
  let currentArtistId = null;
  let lastHomeHash = '';
  let lastLibHash = '';

  const GRADIENT = 'linear-gradient(135deg, rgba(124,92,255,.6), rgba(255,64,158,.4) 55%, rgba(56,132,255,.5))';

  function init() {
    if (initialized) return;
    initialized = true;

    els = {
      homeSection: document.getElementById('homePocuArtists'),
      homeRow:     document.getElementById('homePocuArtistsRow'),
      libSection:  document.getElementById('favPocuArtists'),
      libRow:      document.getElementById('favPocuArtistsRow'),
      screen:      document.getElementById('artistScreen'),
      back:        document.getElementById('artistBackBtn'),
      photo:       document.getElementById('artistPhoto'),
      name:        document.getElementById('artistName'),
      bio:         document.getElementById('artistBio'),
      actions:     document.getElementById('artistActions'),
      tracks:      document.getElementById('artistTracks')
    };

    if (els.back) els.back.addEventListener('click', closeArtist);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && currentArtistId) closeArtist();
    });

    window.PocuPlayer.subscribe(state => {
      if (currentArtistId) PocuTrackCard.syncPlaying(els.tracks, state);
    });

    window.PocuStore.subscribe(state => {
      if (currentArtistId) PocuTrackCard.syncHearts(els.tracks, state.favorites);
      safe(renderHomeSection);
      safe(renderLibSection);
    });

    safe(renderHomeSection);
    safe(renderLibSection);
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

  function openArtist(artistIdOrName) {
    const idStr = String(artistIdOrName || '').trim();
    if (!idStr) return;

    let artist = window.PocuArtists.get(idStr);
    let tracks;

    if (artist) tracks = window.PocuArtists.tracksFor(artist.id);
    else {
      const lower = idStr.toLowerCase();
      tracks = window.PocuLibrary.all().filter(t => {
        const parts = window.PocuArtists.splitArtists(t.artist);
        return parts.includes(lower);
      });
      if (!tracks.length) return;

      const firstWithArt = tracks.find(t => t.artwork);
      artist = {
        id: idStr, name: idStr, bio: '',
        photo: firstWithArt?.artwork || '',
        featured: false, aliases: []
      };
    }

    currentArtistId = artist.id;
    window.PocuRouter?.setHash?.('artist', artist.id);

    els.name.textContent = artist.name;
    els.bio.textContent  = artist.bio || '';
    els.bio.hidden = !artist.bio;

    if (artist.photo) {
      els.photo.style.backgroundImage = `url("${artist.photo}"), ${GRADIENT}`;
      els.photo.classList.remove('artist-photo--placeholder');
      els.photo.textContent = '';
    } else {
      els.photo.style.backgroundImage = GRADIENT;
      els.photo.classList.add('artist-photo--placeholder');
      els.photo.textContent = artist.name.slice(0, 1).toUpperCase();
    }

    renderArtistTracksFromList(artist, tracks);

    document.querySelectorAll('.playlist-overlay, .artist-overlay, .track-overlay, .album-overlay').forEach(el => {
      if (el !== els.screen) el.style.zIndex = '';
    });
    els.screen.style.zIndex = '85';

    els.screen.classList.add('open');
    els.screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('artist-open');
    requestAnimationFrame(() => { els.screen.scrollTop = 0; });
  }

  function renderArtistTracksFromList(artist, tracks) {
    els.actions.replaceChildren();
    if (tracks.length) {
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
      document.dispatchEvent(new CustomEvent('artist:favorites-change', {
        detail: { id: artist.id, active: now }
      }));
    });
    els.actions.appendChild(heart);

    els.tracks.replaceChildren();
    if (!tracks.length) {
      els.tracks.innerHTML = `<div class="state-block"><div class="state-title">Пока нет треков</div></div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    tracks.forEach((track, i) => {
      frag.appendChild(PocuTrackCard.create(track, {
        index: i,
        onPlay: () => window.PocuPlayer.playQueue(tracks, i)
      }));
    });
    els.tracks.appendChild(frag);

    PocuTrackCard.syncPlaying(els.tracks, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts(els.tracks, window.PocuStore.favorites.all());
  }

  function closeArtist() {
    currentArtistId = null;
    window.PocuRouter?.clearHash?.();
    els.screen.classList.remove('open');
    els.screen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('artist-open');
  }

  return {
    init, openArtist, closeArtist,
    isArtistFavorite: id => window.PocuStore.favoriteArtists.has(id),
    toggleArtistFavorite: id => window.PocuStore.favoriteArtists.toggle(id),
    listFavoriteArtists: () => window.PocuStore.favoriteArtists.all()
  };
})();