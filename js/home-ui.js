/* Pocu Music — Главная: Pocu Pulse + подборки + prev/next в hero */
window.PocuHomeUI = (() => {
  let els = {};
  let initialized = false;

  let lastPicksHash     = '';
  let lastRecentHash    = '';
  let lastPlaylistsHash = '';
  let lastArtistsHash   = '';
  let lastSimilarHash   = '';
  let lastTrackId       = null;

  const colorCache    = new Map();
  const colorPromises = new Map();

  function extractAuroraColors(imageUrl) {
    if (!imageUrl) return Promise.resolve(null);
    if (colorCache.has(imageUrl))    return Promise.resolve(colorCache.get(imageUrl));
    if (colorPromises.has(imageUrl)) return colorPromises.get(imageUrl);

    const promise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = 40; c.height = 40;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, 40, 40);
          const data = ctx.getImageData(0, 0, 40, 40).data;
          const sample = (x, y) => {
            const i = (y * 40 + x) * 4;
            return [data[i], data[i + 1], data[i + 2]];
          };
          const raw = [sample(8, 8), sample(32, 32), sample(20, 20)];
          const enhanced = raw.map(([r, g, b]) => {
            const avg = (r + g + b) / 3;
            const boost = 1.7;
            const nr = Math.min(255, Math.round(avg + (r - avg) * boost));
            const ng = Math.min(255, Math.round(avg + (g - avg) * boost));
            const nb = Math.min(255, Math.round(avg + (b - avg) * boost));
            const lum = (nr + ng + nb) / 3;
            const lift = lum < 60 ? 60 - lum : 0;
            return [
              Math.min(255, nr + lift),
              Math.min(255, ng + lift),
              Math.min(255, nb + lift)
            ];
          });
          colorCache.set(imageUrl, enhanced);
          resolve(enhanced);
        } catch (err) { console.warn('[aurora] extract failed:', err); resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
    colorPromises.set(imageUrl, promise);
    return promise;
  }

  function applyAuroraColors(colors) {
    if (!els.pulseCard || !Array.isArray(colors) || colors.length < 3) return;
    const toCss = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    els.pulseCard.style.setProperty('--aurora-1', toCss(colors[0]));
    els.pulseCard.style.setProperty('--aurora-2', toCss(colors[1]));
    els.pulseCard.style.setProperty('--aurora-3', toCss(colors[2]));
  }

  const FUNNY_TITLES = [
    "Погрустим или оторвемся?",
    "Что включим в уши?",
    "Кто сегодня в плейлисте?",
    "Врубаем басы?",
    "Ищем новый вайб?",
    "Какие треки спасут этот день?",
    "Танцы до утра или джаз под кофе?",
    "Готов к музыкальному путешествию?",
    "Что сегодня в твоем сердце?",
    "Ловим настроение?",
    "Выбираю трек, пока завариваешь чай.",
    "Музыка — лучший психолог. С чего начнем?",
    "Окунемся в музыку?",
    "Настроение: музыка.",
    "Я твой личный дирижёр на сегодня."
  ];

  function updateGreeting() {
    const el = document.getElementById('homeGreeting');
    if (!el) return;
    const hour = new Date().getHours();
    let text = 'Добрый вечер';
    if (hour >= 5 && hour < 12) text = 'Доброе утро';
    else if (hour >= 12 && hour < 18) text = 'Добрый день';
    else if (hour >= 18 && hour < 23) text = 'Добрый вечер';
    else text = 'Доброй ночи';
    el.textContent = text;
  }

  function updateTitle() {
    const el = document.getElementById('homeTitle');
    if (!el) return;
    el.textContent = FUNNY_TITLES[Math.floor(Math.random() * FUNNY_TITLES.length)];
  }

  function init() {
    if (initialized) return;
    initialized = true;

    els = {
      pulseCard:        document.getElementById('pulseCard'),
      pulseAurora:      document.getElementById('pulseAurora'),
      pulseArtCard:     document.getElementById('pulseArtCard'),
      pulseArtImg:      document.getElementById('pulseArtImg'),
      pulseTitle:       document.getElementById('pulseTitle'),
      pulseArtist:      document.getElementById('pulseArtist'),
      pulseBrand:       document.getElementById('pulseBrand'),
      pulseQueue:       document.getElementById('pulseQueue'),
      pulsePlay:        document.getElementById('pulsePlay'),
      pulsePrev:        document.getElementById('pulsePrev'),
      pulseNext:        document.getElementById('pulseNext'),
      pulseRefresh:     document.getElementById('pulseRefresh'),
      pulseEq:          document.getElementById('pulseEq'),
      pulseLike:        document.getElementById('pulseLike'),
      pulseDislike:     document.getElementById('pulseDislike'),
      pulseInsightCard: document.getElementById('pulseInsightCard'),
      pulseInsightIcon: document.getElementById('pulseInsightIcon'),
      pulseInsightText: document.getElementById('pulseInsightText'),

      picksRow:      document.getElementById('homePicksRow'),
      picksSection:  document.getElementById('homePicks'),
      recentRow:     document.getElementById('homeRecentRow'),
      recentSection: document.getElementById('homeRecent'),
      playlistsRow:     document.getElementById('homePlaylistsRow'),
      playlistsSection: document.getElementById('homePlaylists'),
      artistsRow:     document.getElementById('homeArtistsRow'),
      artistsSection: document.getElementById('homeArtists'),
      similarRow:     document.getElementById('homeSimilarRow'),
      similarSection: document.getElementById('homeSimilar'),
      similarTitle:   document.getElementById('homeSimilarTitle')
    };

    updateGreeting();
    updateTitle();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') updateGreeting();
    });

    document.addEventListener('pocu:tab-change', (e) => {
      if (e.detail && e.detail.tab === 'home') {
        updateTitle();
        updateGreeting();
      }
    });

    if (els.pulsePlay) {
      els.pulsePlay.addEventListener('click', e => {
        e.stopPropagation();
        togglePulse();
      });
    }
    if (els.pulsePrev) {
      els.pulsePrev.addEventListener('click', e => {
        e.stopPropagation();
        if (els.pulsePrev.classList.contains('disabled')) return;
        try { window.PocuPlayer.prev(); } catch (err) { console.warn(err); }
      });
    }
    if (els.pulseNext) {
      els.pulseNext.addEventListener('click', e => {
        e.stopPropagation();
        if (els.pulseNext.classList.contains('disabled')) return;
        try { window.PocuPlayer.next(); } catch (err) { console.warn(err); }
      });
    }
    if (els.pulseRefresh) {
      els.pulseRefresh.addEventListener('click', e => {
        e.stopPropagation();
        try { window.PocuPulse.refresh(); } catch (err) { console.error(err); }
      });
    }
    if (els.pulseEq) {
      els.pulseEq.addEventListener('click', e => {
        e.stopPropagation();
        window.PocuEquilizerUI?.open?.();
      });
    }

    /* ---- Aurora scatter on hover (только обложка + кнопки) ---- */
    if (els.pulseAurora) {
      const scatterTargets = [
        els.pulseArtCard,
        document.querySelector('.pulse-actions')
      ].filter(Boolean);
      const onEnter = () => els.pulseAurora.classList.add('scatter');
      const onLeave = () => els.pulseAurora.classList.remove('scatter');
      scatterTargets.forEach(el => {
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
      });
    }

    /* ---- LIKE ---- */
    if (els.pulseLike) {
      els.pulseLike.addEventListener('click', e => {
        e.stopPropagation();
        if (els.pulseLike.classList.contains('disabled')) return;
        const track = window.PocuPlayer.current;
        if (!track) return;
        const nowFav = window.PocuStore.favorites.toggle(track.id);
        window.PocuSupabase?.syncFavorite?.(track.id, nowFav);
        els.pulseLike.classList.toggle('active', nowFav);
        if (nowFav) {
          els.pulseLike.classList.add('just-activated');
          setTimeout(() => els.pulseLike.classList.remove('just-activated'), 450);
        }
        els.pulseDislike?.classList.toggle('active', window.PocuStore.disliked.has(track.id));
      });
    }

    /* ---- DISLIKE (с авто-скипом) ---- */
    if (els.pulseDislike) {
      els.pulseDislike.addEventListener('click', e => {
        e.stopPropagation();
        if (els.pulseDislike.classList.contains('disabled')) return;
        const track = window.PocuPlayer.current;
        if (!track) return;
        const nowDisliked = window.PocuStore.disliked.toggle(track.id);
        window.PocuSupabase?.syncDislike?.(track.id, nowDisliked);
        els.pulseDislike.classList.toggle('active', nowDisliked);
        els.pulseLike?.classList.toggle('active', window.PocuStore.favorites.has(track.id));
        if (nowDisliked) {
          setTimeout(() => window.PocuPlayer.next(), 80);
        }
      });
    }

    if (els.pulseCard) {
      els.pulseCard.addEventListener('click', e => {
        if (e.target.closest('.pulse-actions')) return;
        if (e.target.closest('.pulse-insight')) return;
        if (e.target.closest('.pulse-btn')) return;
        togglePulse();
      });
    }

    if (els.pulseInsightCard) {
      els.pulseInsightCard.addEventListener('click', e => {
        e.stopPropagation();
        window.PocuPulseInsightsUI?.open?.();
      });
    }

    if (els.pulseArtCard) {
      els.pulseArtCard.addEventListener('click', e => {
        const track = window.PocuPlayer.current;
        if (track && window.PocuPulse?.active) {
          e.stopPropagation();
          window.PocuTrackCard.openTarget(track);
        }
      });
    }

    if (els.pulseTitle) {
      els.pulseTitle.addEventListener('click', e => {
        const track = window.PocuPlayer.current;
        if (track && window.PocuPulse?.active) {
          e.stopPropagation();
          window.PocuTrackCard.openTarget(track);
        }
      });
    }

    if (els.pulseArtist) {
      els.pulseArtist.addEventListener('click', e => {
        const track = window.PocuPlayer.current;
        if (track && window.PocuPulse?.active) {
          e.stopPropagation();
          const parts = window.PocuArtists.splitTrackArtists(track);
          const name = parts[0] || track.artist;
          if (name) window.PocuArtistUI?.openArtist?.(name);
        }
      });
    }

    document.addEventListener('pulse:update', renderPulseState);

    window.PocuPlayer.subscribe(state => {
      const currentId = state.track ? state.track.id : null;
      if (currentId !== lastTrackId) {
        lastTrackId = currentId;
        safe(renderPulseState);
        safe(renderSimilar);
      } else {
        safe(renderPulseState);
      }
      safe(syncHomeTilesPlaying);
    });

    window.PocuStore.subscribe(() => {
      safe(renderPicks);
      safe(renderPlaylists);
      safe(renderArtists);
      safe(renderRecent);
      safe(renderInsightCard);
      safe(syncPulseActions);
    });

    safe(renderAll);
    safe(renderPulseState);
    safe(renderInsightCard);

    if (els.pulseCard) {
      els.pulseCard.style.setProperty('--aurora-1', 'rgb(124, 92, 255)');
      els.pulseCard.style.setProperty('--aurora-2', 'rgb(255, 64, 158)');
      els.pulseCard.style.setProperty('--aurora-3', 'rgb(56, 132, 255)');
    }

    console.log('[home-ui] init OK, pulsePrev:', !!els.pulsePrev, 'pulseNext:', !!els.pulseNext);
  }

  function syncHomeTilesPlaying() {
    const s = window.PocuPlayer.getState();
    const curId = s.track?.id;
    [els.picksRow, els.recentRow, els.similarRow].forEach(row => {
      if (!row) return;
      row.querySelectorAll('.home-tile[data-id]').forEach(el => {
        el.classList.toggle('playing', !!(s.playing && el.dataset.id === curId));
      });
    });
  }

  function syncPulseActions() {
    const st = window.PocuPlayer.getState();
    const track = st.track;
    const pulseActive = window.PocuPulse?.active;
    const hasTrack = !!track && pulseActive;
    const queueLen = window.PocuPulse?.queue?.length || 0;
    const hasQueue = pulseActive && queueLen > 1;

    if (els.pulseLike) {
      els.pulseLike.classList.toggle('disabled', !hasTrack);
      if (hasTrack) {
        els.pulseLike.classList.toggle('active', window.PocuStore.favorites.has(track.id));
      } else {
        els.pulseLike.classList.remove('active');
      }
    }
    if (els.pulseDislike) {
      els.pulseDislike.classList.toggle('disabled', !hasTrack);
      if (hasTrack) {
        els.pulseDislike.classList.toggle('active', window.PocuStore.disliked.has(track.id));
      } else {
        els.pulseDislike.classList.remove('active');
      }
    }

    if (els.pulsePrev) els.pulsePrev.classList.toggle('disabled', !hasQueue);
    if (els.pulseNext) els.pulseNext.classList.toggle('disabled', !hasQueue);
  }

  function safe(fn) {
    try { fn(); } catch (e) { console.warn('[home-ui]', fn.name, e.message); }
  }

  function togglePulse() {
    try {
      const pulse = window.PocuPulse;
      if (!pulse) { console.error('[home-ui] PocuPulse не загружен'); return; }
      const state = window.PocuPlayer.getState();
      const pulseQueue = pulse.queue;
      const trackInPulse = state.track && pulseQueue.some(t => t.id === state.track.id);
      if (pulse.active && trackInPulse) { window.PocuPlayer.togglePlay(); return; }
      pulse.start(true);
    } catch (e) { console.error('[home-ui] togglePulse failed:', e); }
  }

  function renderAll() {
    renderPicks();
    renderPlaylists();
    renderArtists();
    renderRecent();
    renderSimilar();
  }

  function renderInsightCard() {
    if (!els.pulseInsightCard) return;
    if (!window.PocuPulse?.getInsight) return;

    const lib = window.PocuLibrary.all();
    if (!lib.length) { els.pulseInsightCard.hidden = true; return; }

    const insight = window.PocuPulse.getInsight();
    if (els.pulseInsightIcon) {
      els.pulseInsightIcon.innerHTML = insight.icon || '';
    }
    if (els.pulseInsightText) {
      els.pulseInsightText.textContent = insight.text || 'Pulse изучает ваш вкус';
    }
    els.pulseInsightCard.hidden = false;
  }

  let lastQueueHash = '';

  function renderQueue(state) {
    if (!els.pulseQueue) return;
    if (!window.PocuPulse?.active) {
      els.pulseQueue.innerHTML = '';
      lastQueueHash = '';
      return;
    }
    const upcoming = (state.queue || []).slice(state.queueIndex + 1, state.queueIndex + 4);
    const hash = upcoming.map(t => t.id).join(',');
    if (hash === lastQueueHash) return;
    lastQueueHash = hash;

    if (!upcoming.length) { els.pulseQueue.innerHTML = ''; return; }

    els.pulseQueue.innerHTML = upcoming.map(t => `
      <div class="pulse-queue-item">
        <img src="${t.artwork || ''}" alt="" onerror="this.style.visibility='hidden'">
        <div class="pulse-queue-item-meta">
          <div class="pulse-queue-item-title">${escHtml(t.title)}</div>
          <div class="pulse-queue-item-artist">${escHtml(t.artist)}</div>
        </div>
      </div>
    `).join('');
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function renderPulseState() {
    if (!els.pulseCard) return;
    const playerState = window.PocuPlayer.getState();
    const pulseActive = window.PocuPulse && window.PocuPulse.active;
    const playing     = playerState.playing && pulseActive;
    const hasTrack    = !!playerState.track;
    const trackInPulse = pulseActive && hasTrack &&
      window.PocuPulse.queue.some(t => t.id === playerState.track.id);

    els.pulsePlay?.classList.toggle('playing', playing);

    if (trackInPulse) {
      if (els.pulseArtImg && playerState.track.artwork) {
        els.pulseArtImg.src = playerState.track.artwork;
        els.pulseArtCard?.classList.add('has-track');
      }

      if (playerState.track.artwork) {
        const currentUrl = playerState.track.artwork;
        extractAuroraColors(currentUrl).then(colors => {
          if (window.PocuPlayer.current?.artwork === currentUrl) {
            applyAuroraColors(colors);
          }
        });
      }

      if (els.pulseTitle.textContent !== playerState.track.title) {
        els.pulseTitle.textContent = playerState.track.title;
      }
      if (els.pulseArtist.textContent !== playerState.track.artist) {
        els.pulseArtist.textContent = playerState.track.artist;
      }
      els.pulseBrand.hidden = false;

      els.pulseCard.classList.add('live');
      els.pulseCard.classList.toggle('paused', !playing);

      safe(() => renderQueue(playerState));
    } else {
      els.pulseCard.classList.remove('live', 'paused');
      els.pulseArtCard?.classList.remove('has-track');

      if (els.pulseTitle.textContent !== 'Pocu Pulse') {
        els.pulseTitle.textContent = 'Pocu Pulse';
      }
      if (els.pulseArtist.textContent !== 'Твой личный поток — на основе вкусов') {
        els.pulseArtist.textContent = 'Твой личный поток — на основе вкусов';
      }
      els.pulseBrand.hidden = true;

      if (els.pulseQueue) els.pulseQueue.innerHTML = '';
      lastQueueHash = '';
    }

    safe(renderInsightCard);
    safe(syncPulseActions);
  }

  function renderPicks() {
    if (!els.picksSection) return;
    const all = window.PocuLibrary.all();
    if (!all.length) {
      els.picksSection.hidden = false;
      els.picksRow.innerHTML = `
        <div class="state-block" style="padding: 20px 0;">
          <div class="state-title">Библиотека пуста</div>
          <div class="state-sub">Добавь треки — здесь появятся рекомендации</div>
        </div>`;
      lastPicksHash = '';
      return;
    }

    const dislikedSet = new Set(window.PocuStore.disliked.all());
    let picks = [];
    try {
      picks = (window.PocuPulse.preview(8) || []).filter(t => !dislikedSet.has(t.id));
    } catch (e) {
      console.warn('[home-ui] pulse.preview failed:', e);
      picks = all.filter(t => !dislikedSet.has(t.id)).slice(0, 8);
    }

    if (picks.length < 8) {
      const fallback = all.filter(t => !dislikedSet.has(t.id));
      for (const t of fallback) {
        if (picks.length >= 8) break;
        if (!picks.some(p => p.id === t.id)) picks.push(t);
      }
    }
    if (!picks.length) picks = all.slice(0, 8);
    picks = picks.slice(0, 8);

    const hash = picks.map(t => t.id).join(',');
    if (hash === lastPicksHash) return;
    lastPicksHash = hash;

    els.picksSection.hidden = false;
    els.picksRow.replaceChildren();
    picks.forEach(track => {
      els.picksRow.appendChild(createTile(track, () => {
        window.PocuPlayer.playQueue(picks, picks.indexOf(track));
      }));
    });
  }

  function renderRecent() {
    if (!els.recentSection) return;
    const recents = window.PocuStore.recent.all().slice(0, 8);
    if (!recents.length) { els.recentSection.hidden = true; lastRecentHash = ''; return; }

    const all = window.PocuLibrary.all();
    const map = new Map(all.map(t => [t.id, t]));
    const ordered = recents.map(r => map.get(r.id)).filter(Boolean);
    if (!ordered.length) { els.recentSection.hidden = true; lastRecentHash = ''; return; }

    const hash = ordered.map(t => t.id).join(',');
    if (hash === lastRecentHash) return;
    lastRecentHash = hash;

    els.recentSection.hidden = false;
    els.recentRow.replaceChildren();
    ordered.forEach(track => {
      els.recentRow.appendChild(createTile(track, () => {
        window.PocuPlayer.playQueue(ordered, ordered.indexOf(track));
      }));
    });
  }

  function renderPlaylists() {
    if (!els.playlistsSection) return;
    const playlists = window.PocuStore.playlists.all();
    if (!playlists.length) { els.playlistsSection.hidden = true; lastPlaylistsHash = ''; return; }

    const hash = playlists.map(p => `${p.id}:${p.trackIds.length}`).join('|');
    if (hash === lastPlaylistsHash) return;
    lastPlaylistsHash = hash;

    els.playlistsSection.hidden = false;
    els.playlistsRow.replaceChildren();

    playlists.forEach(pl => {
      const el = document.createElement('div');
      el.className = 'home-tile';
      el.setAttribute('role', 'button');

      const artWrap = document.createElement('div');
      artWrap.className = 'home-tile-art-wrap';

      const art = document.createElement('div');
      art.className = 'home-tile-art';
      const first = pl.trackIds[0] ? window.PocuLibrary.get(pl.trackIds[0]) : null;
      if (first && first.artwork) art.style.backgroundImage = `url("${first.artwork}")`;
      artWrap.appendChild(art);

      const info = document.createElement('div');
      info.className = 'home-tile-info';
      const text = document.createElement('div');
      text.className = 'home-tile-text';

      const name = document.createElement('div');
      name.className = 'home-tile-name';
      name.textContent = pl.name;

      const count = document.createElement('div');
      count.className = 'home-tile-artist';
      count.textContent = `${pl.trackIds.length} треков`;

      text.append(name, count);
      info.appendChild(text);
      el.append(artWrap, info);
      el.addEventListener('click', () => {
        if (window.PocuPlaylistsUI) window.PocuPlaylistsUI.openPlaylistScreen(pl.id);
      });
      els.playlistsRow.appendChild(el);
    });
  }

  function renderArtists() {
    if (!els.artistsSection) return;
    const ids = window.PocuStore.favoriteArtists.all();
    if (!ids.length) { els.artistsSection.hidden = true; lastArtistsHash = ''; return; }

    const lib = window.PocuLibrary.all();
    const hash = ids.join(',');
    if (hash === lastArtistsHash) return;
    lastArtistsHash = hash;

    els.artistsSection.hidden = false;
    els.artistsRow.replaceChildren();

    ids.forEach(id => {
      const pocu = window.PocuArtists.get(id);
      let name, photo;
      if (pocu) {
        name = pocu.name; photo = pocu.photo;
      } else {
        name = id;
        const lower = id.toLowerCase();
        const tracks = lib.filter(t => window.PocuArtists.splitArtists(t.artist).includes(lower));
        photo = tracks.find(t => t.artwork)?.artwork || '';
      }
      els.artistsRow.appendChild(createArtistTile(id, name, photo));
    });
  }

  function createArtistTile(id, name, photo) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'home-tile';

    const artWrap = document.createElement('div');
    artWrap.className = 'home-tile-art-wrap home-tile-art-wrap--round';

    const art = document.createElement('div');
    art.className = 'home-tile-art home-tile-art--round';
    if (photo) {
      art.style.backgroundImage = `url("${photo}")`;
    } else {
      art.classList.add('home-tile-art--placeholder');
      art.textContent = name.slice(0, 1).toUpperCase();
    }
    artWrap.appendChild(art);

    const info = document.createElement('div');
    info.className = 'home-tile-info';
    const text = document.createElement('div');
    text.className = 'home-tile-text';

    const nameEl = document.createElement('div');
    nameEl.className = 'home-tile-name';
    nameEl.textContent = name;

    text.appendChild(nameEl);
    info.appendChild(text);
    tile.append(artWrap, info);

    tile.addEventListener('click', () => window.PocuArtistUI?.openArtist?.(id));
    return tile;
  }

  function renderSimilar() {
    if (!els.similarSection) return;
    const last = window.PocuPlayer.current;
    if (!last || !last.genre) { els.similarSection.hidden = true; lastSimilarHash = ''; return; }

    const dislikedSet = new Set(window.PocuStore.disliked.all());
    const all = window.PocuLibrary.all().filter(t => t.preview && !dislikedSet.has(t.id));
    const similar = all.filter(t => t.genre === last.genre && t.id !== last.id).slice(0, 8);
    if (!similar.length) { els.similarSection.hidden = true; lastSimilarHash = ''; return; }

    const hash = `${last.id}::${last.genre}`;
    if (hash === lastSimilarHash) return;
    lastSimilarHash = hash;

    els.similarSection.hidden = false;
    els.similarTitle.textContent = `Похожее на «${last.title}»`;
    els.similarRow.replaceChildren();
    similar.forEach(track => {
      els.similarRow.appendChild(createTile(track, () => {
        window.PocuPlayer.playQueue(similar, similar.indexOf(track));
      }));
    });
  }

  function createTile(track, onClick) {
    const el = document.createElement('div');
    el.className = 'home-tile';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.dataset.id = track.id;
    el.addEventListener('keydown', e => { if (e.key === 'Enter') onClick(); });

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

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'tile-menu';
    menuBtn.setAttribute('aria-label', 'Действия');
    menuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>`;
    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      const r = menuBtn.getBoundingClientRect();
      window.PocuContextMenu?.openAt?.(track, r.right, r.top);
    });

    info.append(text, menuBtn);

    name.addEventListener('click', e => {
      e.stopPropagation();
      window.PocuTrackCard.openTarget(track);
    });

    artist.addEventListener('click', e => {
      e.stopPropagation();
      const parts = window.PocuArtists.splitTrackArtists(track);
      const n = parts[0] || track.artist;
      if (n) window.PocuArtistUI?.openArtist?.(n);
    });

    el.append(artWrap, info);
    el.addEventListener('click', (e) => {
      if (window.PocuContextMenu?.isSuppressingClick?.()) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      onClick();
    });
    return el;
  }

  return { init };
})();