/* Pocu Music — страница трека */
window.PocuTrackUI = (() => {
  let els = {};
  let initialized = false;
  let currentTrackId = null;

  function init() {
    if (initialized) return;
    initialized = true;

    els = {
      screen:      document.getElementById('trackScreen'),
      back:        document.getElementById('trackBackBtn'),
      art:         document.getElementById('trackPageArt'),
      title:       document.getElementById('trackPageTitle'),
      artist:      document.getElementById('trackPageArtist'),
      info:        document.getElementById('trackPageInfo'),
      actions:     document.getElementById('trackPageActions'),
      similar:     document.getElementById('trackSimilar'),
      similarList: document.getElementById('trackSimilarList')
    };

    if (!els.screen) return;

    els.back?.addEventListener('click', close);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && currentTrackId) close();
    });

    window.PocuPlayer.subscribe(state => {
      if (!currentTrackId) return;
      PocuTrackCard.syncPlaying(els.similarList, state);
      updatePlayButton();
    });

    window.PocuStore.subscribe(state => {
      if (!currentTrackId) return;
      PocuTrackCard.syncHearts(els.similarList, state.favorites);
      updatePlayButton();
    });
  }

  function open(trackId) {
    const track = window.PocuLibrary.get(trackId);
    if (!track) return;

    currentTrackId = track.id;
    window.PocuRouter?.setHash?.('track', track.id);

    els.title.textContent = track.title;
    els.artist.textContent = track.artist;
    els.artist.onclick = () => {
      const parts = window.PocuArtists.splitArtists(track.artist);
      const name = parts[0] || track.artist;
      if (name) window.PocuArtistUI?.openArtist?.(name);
    };

    if (track.artwork) {
      els.art.src = track.artwork;
      els.art.style.visibility = '';
    } else {
      els.art.removeAttribute('src');
    }

    /* метаданные: кликабельный альбом · жанр · длительность */
    els.info.replaceChildren();
    if (track.album) {
      const albumLink = document.createElement('span');
      albumLink.className = 'track-page-album';
      albumLink.textContent = track.album;
      albumLink.addEventListener('click', () => {
        window.PocuAlbumUI?.open?.(track.artist, track.album);
      });
      els.info.appendChild(albumLink);
    }
    if (track.genre) {
      if (els.info.children.length) els.info.appendChild(document.createTextNode(' · '));
      els.info.appendChild(document.createTextNode(track.genre));
    }
    if (track.duration) {
      if (els.info.children.length) els.info.appendChild(document.createTextNode(' · '));
      els.info.appendChild(document.createTextNode(formatDuration(track.duration)));
    }

    renderActions(track);
    renderSimilar(track);

    document.querySelectorAll('.playlist-overlay, .artist-overlay, .track-overlay, .album-overlay')
      .forEach(el => { if (el !== els.screen) el.style.zIndex = ''; });
    els.screen.style.zIndex = '85';

    els.screen.classList.add('open');
    els.screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('track-open');
    requestAnimationFrame(() => { els.screen.scrollTop = 0; });
  }

  function close() {
    if (!els.screen) return;
    currentTrackId = null;
    window.PocuRouter?.clearHash?.();
    els.screen.classList.remove('open');
    els.screen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('track-open');
  }

  function renderActions(track) {
    els.actions.replaceChildren();

    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn-primary';
    playBtn.id = 'tpPlay';
    els.actions.appendChild(playBtn);

    const plBtn = document.createElement('button');
    plBtn.className = 'btn btn-secondary';
    plBtn.textContent = 'В плейлист';
    els.actions.appendChild(plBtn);

    const heart = document.createElement('button');
    heart.type = 'button';
    heart.className = 'fav-heart';
    heart.id = 'tpFav';
    heart.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20.2s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.2 2.7c0 4.9-7.2 9.3-7.2 9.3z"/>
      </svg>`;
    els.actions.appendChild(heart);

    playBtn.addEventListener('click', () => {
      if (window.PocuPlayer.current?.id === track.id) {
        window.PocuPlayer.togglePlay();
      } else {
        window.PocuPlayer.play(track);
      }
    });

    heart.addEventListener('click', () => {
      const wasFav = window.PocuStore.favorites.has(track.id);
      window.PocuStore.favorites.toggle(track.id);
      window.PocuSupabase?.syncFavorite(track.id, !wasFav);
      if (!wasFav) {
        heart.classList.add('just-activated');
        setTimeout(() => heart.classList.remove('just-activated'), 450);
      }
      updatePlayButton();
    });

    plBtn.addEventListener('click', () => {
      const r = plBtn.getBoundingClientRect();
      window.PocuContextMenu?.openAt?.(track, r.right, r.top);
    });

    updatePlayButton();
  }

  function updatePlayButton() {
    const btn = document.getElementById('tpPlay');
    const favBtn = document.getElementById('tpFav');
    if (!btn || !currentTrackId) return;

    const isCurrent = window.PocuPlayer.current?.id === currentTrackId;
    const playing = isCurrent && window.PocuPlayer.getState().playing;

    btn.textContent = isCurrent
      ? (playing ? 'Пауза' : 'Продолжить')
      : 'Играть';

    if (favBtn) {
      const isFav = window.PocuStore.favorites.has(currentTrackId);
      favBtn.classList.toggle('active', isFav);
      favBtn.setAttribute('aria-label', isFav ? 'Убрать из избранного' : 'В избранное');
    }
  }

  function renderSimilar(track) {
    if (!track.genre) {
      els.similar.hidden = true;
      return;
    }
    const all = window.PocuLibrary.all().filter(t => t.preview && t.id !== track.id);
    const similar = all.filter(t => t.genre === track.genre).slice(0, 8);
    if (!similar.length) {
      els.similar.hidden = true;
      return;
    }
    els.similar.hidden = false;
    els.similarList.replaceChildren();

    similar.forEach((t, i) => {
      els.similarList.appendChild(PocuTrackCard.create(t, {
        index: i,
        showHeart: false,
        onPlay: () => window.PocuPlayer.playQueue(similar, i)
      }));
    });

    PocuTrackCard.syncPlaying(els.similarList, window.PocuPlayer.getState());
  }

  function formatDuration(sec) {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return { init, open, close };
})();