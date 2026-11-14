/* Pocu Music — общий рендер трека (поиск / медиатека / избранное) */
window.PocuTrackCard=(()=> {
  /* Единая точка правды: куда ведёт «открыть трек»
     - есть album → страница альбома
     - нет album → страница трека
     - opts.disableOpen — вообще ничего (страница альбома) */
  function openTarget(track, opts = {}) {
    if (!track) return;
    if (opts.disableOpen) return;
    if (track.album && window.PocuAlbumUI?.open) {
      window.PocuAlbumUI.open(track.artist, track.album);
      return;
    }
    window.PocuTrackUI?.open?.(track.id);
  }

  function create(track, opts = {}) {
    const {
      onPlay,
      onRemove,
      index     = 0,
      showHeart = true,
      showRemove = false,
      animate   = true,
      disableOpen = false
    } = opts;

    const el = document.createElement('div');
    el.className = 'track';
    el.dataset.id = track.id;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    if (animate) {
      el.style.animation = 'rise .5s var(--spring) both';
      el.style.animationDelay = `${Math.min(index * 35, 360)}ms`;
    }

    function handleOpenClick(e) {
      if (disableOpen) return;
      e.stopPropagation();
      openTarget(track);
    }

    /* --- обложка --- */
    const artWrap = document.createElement('div');
    artWrap.className = 'track-art-wrap';

    const art = document.createElement('img');
    art.className = 'track-art';
    art.loading  = 'lazy';
    art.decoding = 'async';
    art.alt = '';
    if (track.artwork) art.src = track.artwork;
    art.addEventListener('error', () => { art.style.visibility = 'hidden'; });

    artWrap.append(art);
    artWrap.addEventListener('click', handleOpenClick);

    /* --- meta --- */
    const meta = document.createElement('div');
    meta.className = 'track-meta';

    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = track.title;
    if (!disableOpen) title.style.cursor = 'pointer';
    title.addEventListener('click', handleOpenClick);

    const artist = document.createElement('div');
    artist.className = 'track-artist';
    artist.textContent = track.artist;
    artist.style.cursor = 'pointer';
    artist.addEventListener('click', e => {
      e.stopPropagation();
      openArtistFromTrack(track);
    });

    meta.append(title, artist);

    /* --- menu ⋮ (только ПК) --- */
    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'track-menu';
    menuBtn.setAttribute('aria-label', 'Действия');
    menuBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5"  r="1.8"/>
        <circle cx="12" cy="12" r="1.8"/>
        <circle cx="12" cy="19" r="1.8"/>
      </svg>`;
    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      const r = menuBtn.getBoundingClientRect();
      window.PocuContextMenu?.openAt?.(track, r.right, r.top);
    });

    /* --- heart --- */
    let heart = null;
    if (showHeart && window.PocuStore) {
      heart = document.createElement('button');
      heart.type = 'button';
      heart.className = 'track-heart';
      heart.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20.2s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.2 2.7c0 4.9-7.2 9.3-7.2 9.3z"/>
        </svg>`;

      const has = window.PocuStore.favorites.has(track.id);
      heart.classList.toggle('active', has);
      heart.setAttribute('aria-label', has ? 'Убрать из избранного' : 'В избранное');

      heart.addEventListener('click', e => {
        e.stopPropagation();
        // toggle() сам мутирует store и возвращает НОВОЕ состояние (true = в избранном)
        const nowActive = window.PocuStore.favorites.toggle(track.id);
        window.PocuSupabase?.syncFavorite(track.id, nowActive);
        // Немедленно обновляем визуал сердечка в этой карточке
        heart.classList.toggle('active', nowActive);
        heart.setAttribute('aria-label', nowActive ? 'Убрать из избранного' : 'В избранное');
        if (nowActive) {
          heart.classList.add('just-activated');
          setTimeout(() => heart.classList.remove('just-activated'), 450);
        }
      });
    }

    /* --- remove (только плейлист) --- */
    let remove = null;
    if (showRemove && onRemove) {
      remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'track-remove';
      remove.setAttribute('aria-label', 'Убрать из плейлиста');
      remove.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>`;
      remove.addEventListener('click', e => {
        e.stopPropagation();
        onRemove(track, index);
      });
    }

    /* --- play --- */
    const play = document.createElement('div');
    play.className = 'track-play';
    play.innerHTML = `
      <svg class="icon-play"  width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      <svg class="icon-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>`;

    el.append(artWrap, meta, menuBtn);
    if (heart)  el.append(heart);
    if (remove) el.append(remove);
    el.append(play);

    el.addEventListener('click', (e) => {
      if (window.PocuContextMenu?.isSuppressingClick?.()) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (onPlay) onPlay(track, index);
      else window.PocuPlayer.play(track);
    });

    return el;
  }

  /* ---------- sync helpers ---------- */
  function syncPlaying(container, state) {
    const activeId = state.track ? state.track.id : null;
    container.querySelectorAll('.track[data-id]').forEach(el => {
      const cur = activeId && el.dataset.id === activeId;
      el.classList.toggle('playing', !!(cur && state.playing));
    });
  }

  function syncHearts(container, favoritesArr) {
    const set = new Set(favoritesArr);
    container.querySelectorAll('.track[data-id]').forEach(el => {
      const h = el.querySelector('.track-heart');
      if (!h) return;
      const has = set.has(el.dataset.id);
      if (h.classList.contains('active') !== has) {
        h.classList.toggle('active', has);
        h.setAttribute('aria-label', has ? 'Убрать из избранного' : 'В избранное');
      }
    });
  }

  function openArtistFromTrack(track) {
    if (!track) return;
    let name = '';
    if (track.artistId) {
      const a = window.PocuArtists.get(track.artistId);
      if (a) name = a.name;
    }
    if (!name) {
      const parts = window.PocuArtists.splitArtists(track.artist);
      name = parts[0] || track.artist;
    }
    if (name) window.PocuArtistUI?.openArtist?.(name);
  }

  return { create, syncPlaying, syncHearts, openTarget };
})();