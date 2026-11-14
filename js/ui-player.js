/* Pocu Music — UI-слой плеера: мини-плеер, now-playing, свайпы */
window.PocuUI = (() => {
  let els = {};
  let scrubbing = false;
  let drag = null;
  let miniSuppressClick = false;

  function init() {
    els = {
      /* mini */
      mini:     document.getElementById('miniplayer'),
      mpArt:    document.getElementById('mpArt'),
      mpTitle:  document.getElementById('mpTitle'),
      mpArtist: document.getElementById('mpArtist'),
      mpToggle: document.getElementById('mpToggle'),
      mpFill:   document.getElementById('mpFill'),
      mpHeart:  document.getElementById('mpHeart'),

      /* now playing */
      np:           document.getElementById('nowPlaying'),
      npBg:         document.getElementById('npBg'),
      npClose:      document.getElementById('npClose'),
      npHeader:     document.querySelector('.np-header'),
      npArt:        document.getElementById('npArt'),
      npTitle:      document.getElementById('npTitle'),
      npArtist:     document.getElementById('npArtist'),
      npProgress:   document.getElementById('npProgress'),
      npFill:       document.getElementById('npFill'),
      npThumb:      document.getElementById('npThumb'),
      npTime:       document.getElementById('npTime'),
      npDuration:   document.getElementById('npDuration'),
      npShuffle:    document.getElementById('npShuffle'),
      npPrev:       document.getElementById('npPrev'),
      npPlay:       document.getElementById('npPlay'),
      npNext:       document.getElementById('npNext'),
      npRepeat:     document.getElementById('npRepeat'),
      npHeart:      document.getElementById('npHeart'),
      npDislike:    document.getElementById('npDislike'),
      npVolume:     document.getElementById('npVolume'),
      npVolumeIcon: document.getElementById('npVolumeIcon'),
      mpVolume:     document.getElementById('mpVolume'),
      mpVolumeIcon: document.getElementById('mpVolumeIcon')
    };

    /* controls */
    els.mpToggle.addEventListener('click', e => {
      e.stopPropagation();
      window.PocuPlayer.togglePlay();
    });

    els.mpHeart?.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavoriteCurrent();
    });

    els.mini.addEventListener('click', e => {
      if (miniSuppressClick) return;
      if (e.target.closest('.mp-btn') ||
          e.target.closest('.mp-heart') ||
          e.target.closest('.mp-volume')) return;
      openNowPlaying();
    });

    els.npClose.addEventListener('click', closeNowPlaying);
    els.npPlay.addEventListener('click', () => window.PocuPlayer.togglePlay());
    els.npPrev.addEventListener('click', () => window.PocuPlayer.prev());
    els.npNext.addEventListener('click', () => window.PocuPlayer.next());
    els.npShuffle.addEventListener('click', () => window.PocuPlayer.toggleShuffle());
    els.npRepeat.addEventListener('click', () => window.PocuPlayer.cycleRepeat());
    els.npHeart?.addEventListener('click', toggleFavoriteCurrent);
    els.npDislike?.addEventListener('click', toggleDislikeCurrent);

    // Клик по имени артиста в mini-player
    els.mpArtist?.addEventListener('click', e => {
      e.stopPropagation();
      openCurrentArtist();
    });

    // Клик по имени артиста в now-playing
    els.npArtist?.addEventListener('click', e => {
      e.stopPropagation();
      openCurrentArtist();
    });

    setupScrubber();
    setupDragToClose();
    setupMiniSwipe();
    setupNpSwipe();

    window.PocuPlayer.subscribe(render);

    // Восстановить сохранённую громкость (localStorage — без Store)
    try {
      const raw = localStorage.getItem('pocu.volume');
      const savedVol = raw !== null ? parseFloat(raw) : 1;
      if (!isNaN(savedVol) && savedVol >= 0 && savedVol <= 1) {
        window.PocuPlayer.setVolume(savedVol);
      }
    } catch {}

    setupVolume();
    
    // Слушаем изменения избранного, чтобы обновлять сердечки
    if (window.PocuStore) {
      window.PocuStore.subscribe(() => updateHearts());
    }
  }

  /* ---------- helpers ---------- */
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /* ---------- render ---------- */
  function render(state) {
    try {
      renderInner(state);
    } catch (e) {
      console.warn('[ui-player] render failed:', e.message);
    }
  }

  function renderInner(state) {
    const { track, playing, time, duration, shuffle, repeat } = state;

    /* mini-player */
    if (track) {
      els.mini.hidden = false;
      document.body.classList.add('has-miniplayer');

      els.mpTitle.textContent  = track.title;
      els.mpArtist.textContent = track.artist;

      if (track.artwork && els.mpArt.getAttribute('src') !== track.artwork) {
        els.mpArt.src = track.artwork;
        els.mpArt.style.visibility = '';
      }
    } else {
      els.mini.hidden = true;
      document.body.classList.remove('has-miniplayer');
    }
    els.mpToggle.classList.toggle('playing', playing);
    updateDislikeState();

    /* progress */
    const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
    els.mpFill.style.width = `${pct}%`;

    if (!scrubbing) {
      els.npFill.style.width = `${pct}%`;
      els.npThumb.style.left = `${pct}%`;
      els.npTime.textContent = formatTime(time);
    }
    els.npDuration.textContent = formatTime(duration);

    /* now playing meta */
    if (track) {
      els.npTitle.textContent  = track.title;
      els.npArtist.textContent = track.artist;

      if (track.artwork) {
        if (els.npArt.getAttribute('src') !== track.artwork) {
          els.npArt.src = track.artwork;
          els.npBg.style.backgroundImage = `url("${track.artwork}")`;
        }
      } else {
        els.npArt.removeAttribute('src');
        els.npBg.style.backgroundImage = '';
      }
    }

    els.npPlay.classList.toggle('playing', playing);
    els.npShuffle.classList.toggle('active', shuffle);
    els.npRepeat.dataset.mode = repeat;

    updateVolumeUI(state);
    updateHearts();
  }

  /* ---------- heart logic ---------- */
  function toggleFavoriteCurrent() {
    const t = window.PocuPlayer.current;
    if (!t) return;
    const wasFav = window.PocuStore.favorites.has(t.id);
    window.PocuStore.favorites.toggle(t.id);
    window.PocuSupabase?.syncFavorite(t.id, !wasFav);
  }

  function updateHearts() {
    const t = window.PocuPlayer.current;
    const isFav = t ? window.PocuStore.favorites.has(t.id) : false;

    const apply = (el) => {
      if (!el) return;
      const had = el.classList.contains('active');
      el.classList.toggle('active', isFav);
      if (!had && isFav) {
        el.classList.add('just-activated');
        setTimeout(() => el.classList.remove('just-activated'), 450);
      }
    };
    apply(els.mpHeart);
    apply(els.npHeart);

    updateDislikeState();   // ← добавили
  }

  /* ---------- scrubbing ---------- */
  function setupScrubber() {
    const el = els.npProgress;

    function pctFromEvent(e) {
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    }

    el.addEventListener('pointerdown', e => {
      scrubbing = true;
      el.classList.add('scrubbing');
      el.setPointerCapture(e.pointerId);
      updateScrub(pctFromEvent(e));
    });

    el.addEventListener('pointermove', e => {
      if (!scrubbing) return;
      updateScrub(pctFromEvent(e));
    });

    function end(e) {
      if (!scrubbing) return;
      scrubbing = false;
      el.classList.remove('scrubbing');
      const pct = pctFromEvent(e);
      const d = window.PocuPlayer.getState().duration || 0;
      window.PocuPlayer.seek(pct * d);
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function updateScrub(pct) {
    els.npFill.style.width = `${pct * 100}%`;
    els.npThumb.style.left = `${pct * 100}%`;
    const d = window.PocuPlayer.getState().duration || 0;
    els.npTime.textContent = formatTime(pct * d);
  }

  /* ---------- open / close now-playing ---------- */
  function openNowPlaying() {
    if (!window.PocuPlayer.current) return;
    els.np.classList.add('open');
    els.np.setAttribute('aria-hidden', 'false');
    document.body.classList.add('np-open');
  }

  function closeNowPlaying() {
    els.np.classList.remove('open');
    els.np.setAttribute('aria-hidden', 'true');
    els.np.style.transform = '';
    document.body.classList.remove('np-open');
  }

  /* ---------- drag-to-close ---------- */
  function setupDragToClose() {
    els.npHeader.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      drag = { id: e.pointerId, startY: e.clientY, dy: 0 };
      els.npHeader.setPointerCapture(e.pointerId);
      els.np.classList.add('dragging');
    });

    els.npHeader.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = Math.max(0, e.clientY - drag.startY);
      drag.dy = dy;
      els.np.style.transform = `translateY(${dy}px)`;
    });

    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = drag.dy;
      drag = null;
      els.np.classList.remove('dragging');
      if (dy > 120) {
        closeNowPlaying();
      } else {
        els.np.style.transform = '';
      }
    }
    els.npHeader.addEventListener('pointerup', end);
    els.npHeader.addEventListener('pointercancel', end);
  }

  /* ---------- swipe: mini-player ---------- */
  function setupMiniSwipe() {
    const el = els.mini;
    if (!el) return;
    let d = null;

    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.mp-btn') ||
          e.target.closest('.mp-heart') ||
          e.target.closest('.mp-volume')) return;
      d = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dx: 0, dy: 0,
        moved: false
      };
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.classList.add('swiping');
    });

    el.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      d.dx = dx;
      d.dy = dy;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) d.moved = true;

      if (Math.abs(dx) > Math.abs(dy)) {
        el.style.transform = `translate3d(${dx * 0.55}px, 0, 0)`;
        el.style.opacity = String(1 - Math.min(0.55, Math.abs(dx) / 360));
      } else if (dy < 0) {
        el.style.transform = `translate3d(0, ${Math.max(-24, dy * 0.35)}px, 0)`;
      }
    });

    function end(e) {
      if (!d || e.pointerId !== d.id) return;
      const { dx, dy, moved } = d;
      d = null;
      el.classList.remove('swiping');
      el.style.transform = '';
      el.style.opacity = '';

      if (!moved) return;

      miniSuppressClick = true;
      setTimeout(() => { miniSuppressClick = false; }, 60);

      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) window.PocuPlayer.next();
        else        window.PocuPlayer.prev();
      } else if (dy < -45 && Math.abs(dy) > Math.abs(dx)) {
        openNowPlaying();
      }
    }

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /* ---------- swipe: now-playing artwork ---------- */
  function setupNpSwipe() {
    const el = document.querySelector('.np-art-wrap');
    if (!el) return;
    let d = null;

    el.addEventListener('pointerdown', e => {
      d = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dx: 0, dy: 0,
        moved: false
      };
      try { el.setPointerCapture(e.pointerId); } catch {}
      els.npArt.classList.add('swiping');
    });

    el.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      d.dx = dx;
      d.dy = dy;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) d.moved = true;

      if (Math.abs(dx) > Math.abs(dy)) {
        els.npArt.style.transform =
          `translate3d(${dx * 0.45}px, 0, 0) rotate(${dx * 0.015}deg)`;
      }
    });

    function end(e) {
      if (!d || e.pointerId !== d.id) return;
      const { dx, dy, moved } = d;
      d = null;
      els.npArt.classList.remove('swiping');
      els.npArt.style.transform = '';

      if (!moved) return;

      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) window.PocuPlayer.next();
        else        window.PocuPlayer.prev();
      }
    }

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /* ---------- dislike ---------- */
  function toggleDislikeCurrent() {
    const t = window.PocuPlayer.current;
    if (!t) return;
    const wasDisliked = window.PocuStore.disliked.has(t.id);
    window.PocuStore.disliked.toggle(t.id);
    window.PocuSupabase?.syncDislike?.(t.id, !wasDisliked);
    updateDislikeState();
    // Если ставим дизлайк текущему — сразу переключаем на следующий
    if (!wasDisliked) {
      setTimeout(() => window.PocuPlayer.next(), 150);
    }
  }

  function updateDislikeState() {
    const t = window.PocuPlayer.current;
    const isDisliked = t ? window.PocuStore.disliked.has(t.id) : false;
    els.npDislike?.classList.toggle('active', isDisliked);
  }

  /* ---------- artist ---------- */
  function openCurrentArtist() {
    const t = window.PocuPlayer.current;
    if (!t) return;
    let name = '';
    if (t.artistId) {
      const a = window.PocuArtists.get(t.artistId);
      if (a) name = a.name;
    }
    if (!name) {
      const parts = window.PocuArtists.splitArtists(t.artist);
      name = parts[0] || t.artist;
    }
    if (!name) return;
    // Если открываем из now-playing — сначала закроем его
    if (els.np?.classList.contains('open')) closeNowPlaying();
    window.PocuArtistUI?.openArtist?.(name);
  }

  /* ---------- volume ---------- */
  function setupVolume() {
    const bind = (slider, icon) => {
      if (slider) {
        slider.addEventListener('input', e => {
          window.PocuPlayer.setVolume(parseFloat(e.target.value));
        });
      }
      if (icon) {
        icon.addEventListener('click', e => {
          e.stopPropagation();
          window.PocuPlayer.toggleMute();
        });
      }
    };
    bind(els.npVolume, els.npVolumeIcon);
    bind(els.mpVolume, els.mpVolumeIcon);
  }

  function updateVolumeUI(state) {
    const v = state.muted ? 0 : state.volume;
    const isMuted = state.muted || state.volume === 0;

    [els.npVolume, els.mpVolume].forEach(sl => {
      if (!sl) return;
      if (document.activeElement !== sl) sl.value = state.volume;
    });

    [els.npVolumeIcon, els.mpVolumeIcon].forEach(ic => {
      if (!ic) return;
      ic.classList.toggle('is-muted', isMuted);
    });
  }

  return { init, openNowPlaying, closeNowPlaying };
})();