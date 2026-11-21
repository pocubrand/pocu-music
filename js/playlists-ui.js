/* Pocu Music — UI плейлистов (entity layout) */
window.PocuPlaylistsUI = (() => {
  let els = {};
  let initialized = false;
  let current = null;        // { id, mode: 'own'|'public', data, loading? }
  let descSheetEl = null;

  function init() {
    if (initialized) return;
    initialized = true;

    /* --- Экран: используем существующий #playlistScreen или создаём --- */
    let screen = document.getElementById('playlistScreen');
    if (!screen) {
      screen = document.createElement('div');
      screen.className = 'playlist-overlay';
      screen.id = 'playlistScreen';
      document.body.appendChild(screen);
    }
    screen.setAttribute('aria-hidden', 'true');
    screen.innerHTML = `
      <div class="playlist-overlay-inner entity-page">
        <div class="entity-header">
          <button class="back-btn entity-back" id="playlistBackBtn" aria-label="Назад">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Назад</span>
          </button>
          <div class="entity-cover-wrap">
            <div class="entity-cover" id="playlistCover"></div>
          </div>
          <div class="entity-meta">
            <div class="entity-type" id="playlistType">Плейлист</div>
            <h1 class="entity-title" id="playlistTitle">—</h1>
            <div class="entity-sub" id="playlistAuthor"></div>
            <div class="entity-info" id="playlistInfo"></div>
            <div class="entity-info" id="playlistDesc" style="display:none"></div>
            <div class="entity-actions" id="playlistActions"></div>
          </div>
        </div>
        <div class="entity-tracks" id="playlistTracks"></div>
      </div>
    `;

    els = {
      libPlaylists:   document.getElementById('libPlaylists'),
      sheet:          document.getElementById('sheet-create-playlist'),
      sheetInput:     document.getElementById('sheetPlaylistName'),
      sheetCreateBtn: document.getElementById('sheetCreateBtn'),
      sheetCancelBtn: document.getElementById('sheetCancelBtn'),
      screen:         screen,
      back:           screen.querySelector('#playlistBackBtn'),
      cover:          screen.querySelector('#playlistCover'),
      type:           screen.querySelector('#playlistType'),
      title:          screen.querySelector('#playlistTitle'),
      author:         screen.querySelector('#playlistAuthor'),
      info:           screen.querySelector('#playlistInfo'),
      desc:           screen.querySelector('#playlistDesc'),
      actions:        screen.querySelector('#playlistActions'),
      tracks:         screen.querySelector('#playlistTracks')
    };

    document.getElementById('createPlaylistBtn')?.addEventListener('click', openSheet);
    els.sheetCancelBtn?.addEventListener('click', closeSheet);
    els.sheetCreateBtn?.addEventListener('click', createPlaylist);
    els.sheet?.addEventListener('click', e => { if (e.target === els.sheet) closeSheet(); });
    els.back.addEventListener('click', closeScreen);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && current) closeScreen();
    });

    window.PocuStore.subscribe(state => {
      renderPlaylists(state.playlists);
      if (current && current.mode === 'own') {
        const fresh = window.PocuStore.playlists.get(current.id);
        if (fresh) current.data = fresh;
        renderScreen();
      }
    });

    window.PocuPlayer.subscribe(state => {
      if (!current) return;
      PocuTrackCard.syncPlaying(els.tracks, state);
    });

    window.addEventListener('online', () => { if (current?.mode === 'public') refreshPublic(); });
    window.addEventListener('offline', () => { if (current?.mode === 'public') renderScreen(); });

    ensureDescSheet();
  }

  /* ============ Список плейлистов в «Избранном» ============ */
  function renderPlaylists(playlists) {
    if (!els.libPlaylists) return;
    els.libPlaylists.replaceChildren();
    if (!playlists.length) {
      els.libPlaylists.innerHTML = '<p class="hint">У тебя пока нет плейлистов</p>';
      return;
    }
    playlists.forEach(pl => els.libPlaylists.appendChild(createPlaylistTile(pl, 'own')));
  }

  function createPlaylistTile(pl, mode) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'home-tile';
    el.dataset.playlistId = pl.id;

    const artWrap = document.createElement('div');
    artWrap.className = 'home-tile-art-wrap';
    const art = document.createElement('div');
    art.className = 'home-tile-art';

    if (pl.coverUrl) {
      art.style.backgroundImage = `url("${pl.coverUrl}")`;
    } else {
      const first = pl.trackIds?.[0] ? window.PocuLibrary.get(pl.trackIds[0]) : null;
      if (first?.artwork) art.style.backgroundImage = `url("${first.artwork}")`;
      else {
        art.classList.add('home-tile-art--placeholder');
        art.textContent = (pl.name || '?').slice(0, 1).toUpperCase();
        art.style.background = 'linear-gradient(135deg, #7c5cff, #ff409e)';
      }
    }
    artWrap.appendChild(art);

    if (pl.isPublic) {
      const badge = document.createElement('div');
      badge.className = 'playlist-public-badge';
      badge.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';
      artWrap.appendChild(badge);
    }

    const info = document.createElement('div');
    info.className = 'home-tile-info';
    const text = document.createElement('div');
    text.className = 'home-tile-text';
    const name = document.createElement('div');
    name.className = 'home-tile-name';
    name.textContent = pl.name;
    const count = document.createElement('div');
    count.className = 'home-tile-artist';
    count.textContent = mode === 'public' && pl.authorName
      ? `${pl.authorName} · ${pl.trackIds.length} трек.`
      : `${pl.trackIds.length} ${plural(pl.trackIds.length)}`;
    text.append(name, count);
    info.appendChild(text);
    el.append(artWrap, info);

    el.addEventListener('click', () => openPlaylist(pl.id, mode));
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

  /* ============ Sheet создания ============ */
  function openSheet() {
    els.sheetInput.value = '';
    els.sheet.classList.add('open');
    setTimeout(() => els.sheetInput.focus(), 100);
  }
  function closeSheet() {
    els.sheet.classList.remove('open');
    els.sheetInput.blur();
  }
  function createPlaylist() {
    const name = els.sheetInput.value.trim();
    if (!name) { els.sheetInput.focus(); return; }
    const user = window.PocuSupabase?.getUser?.();
    const pl = window.PocuStore.playlists.create(name, {
      authorName: window.PocuStore.profile.get().displayName
        || (user?.email || '').split('@')[0] || ''
    });
    window.PocuSupabase?.syncPlaylistCreate(pl);
    closeSheet();
  }

  /* ============ Открытие / закрытие ============ */
  function openPlaylist(id, mode) {
    if (!initialized) init();

    if (mode === 'own') {
      const pl = window.PocuStore.playlists.get(id);
      if (!pl) return;
      current = { id, mode: 'own', data: pl };
    } else {
      const cached = window.PocuStore.favoritePlaylists.get(id);
      current = { id, mode: 'public', data: cached || null, loading: !cached };
    }

    window.PocuRouter?.setHash?.('playlist', id);
    window.PocuLayers?.front?.(els.screen);

    els.screen.classList.add('open');
    els.screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('playlist-open');

    requestAnimationFrame(() => {
      const inner = els.screen.querySelector('.playlist-overlay-inner');
      if (inner) inner.scrollTop = 0;
    });

    renderScreen();
    if (current.mode === 'public' && !current.data) refreshPublic();
  }

  function openPlaylistScreen(id) { openPlaylist(id, resolveMode(id)); }

  function resolveMode(id) {
    if (window.PocuStore.playlists.get(id)) return 'own';
    return 'public';
  }

  async function refreshPublic() {
    if (!current || current.mode !== 'public') return;
    const data = await window.PocuSupabase?.fetchPublicPlaylistById?.(current.id);
    if (data) {
      current.data = data;
      current.loading = false;
      if (window.PocuStore.favoritePlaylists.has(data.id)) {
        window.PocuStore.favoritePlaylists.remove(data.id);
        window.PocuStore.favoritePlaylists.add(data);
      }
      renderScreen();
    } else {
      current.loading = false;
      if (!navigator.onLine) renderScreen();
    }
  }

  function closeScreen() {
    if (!els.screen) return;
    current = null;
    window.PocuRouter?.clearHash?.();
    window.PocuLayers?.reset?.(els.screen);
    els.screen.classList.remove('open');
    els.screen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('playlist-open');
  }

  /* ============ Рендер ============ */
  function renderScreen() {
    if (!current) return;

    if (current.loading) {
      els.type.textContent = 'Плейлист';
      els.title.textContent = '—';
      els.author.textContent = '';
      els.author.style.display = 'none';
      els.info.innerHTML = '<div class="shimmer" style="height:14px;width:60%"></div>';
      els.desc.style.display = 'none';
      els.cover.style.backgroundImage = '';
      els.cover.textContent = '?';
      els.actions.innerHTML = '';
      els.tracks.innerHTML = '';
      return;
    }

    if (!current.data) {
      els.type.textContent = 'Плейлист';
      els.title.textContent = navigator.onLine ? 'Плейлист не найден' : 'Нет соединения';
      els.author.textContent = '';
      els.author.style.display = 'none';
      els.info.textContent = navigator.onLine
        ? 'Возможно, он был удалён или стал приватным'
        : 'Публичные плейлисты недоступны офлайн';
      els.desc.style.display = 'none';
      els.cover.style.backgroundImage = '';
      els.cover.textContent = '?';
      els.actions.innerHTML = '';
      els.tracks.innerHTML = '';
      return;
    }

    const pl = current.data;
    const isOwn = current.mode === 'own';

    /* --- обложка --- */
    let coverSrc = pl.coverUrl || '';
    if (!coverSrc) {
      const first = pl.trackIds?.[0] ? window.PocuLibrary.get(pl.trackIds[0]) : null;
      if (first?.artwork) coverSrc = first.artwork;
    }
    if (coverSrc) {
      els.cover.style.backgroundImage = `url("${coverSrc}")`;
      els.cover.textContent = '';
    } else {
      els.cover.style.backgroundImage = '';
      els.cover.textContent = (pl.name || '?').slice(0, 1).toUpperCase();
    }

    /* --- тип / заголовок / автор --- */
    els.type.textContent = isOwn ? 'Мой плейлист' : 'Плейлист';
    els.title.textContent = pl.name || 'Без названия';

    if (!isOwn) {
      els.author.textContent = pl.authorName || 'Аноним';
      els.author.style.display = '';
    } else {
      els.author.textContent = '';
      els.author.style.display = 'none';
    }

    /* --- инфо: N треков • M мин. • Публичный/Приватный --- */
    const ordered = resolveOrderedTracks(pl);
    const totalSec = ordered.reduce((s, t) => s + (t.duration || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    const infoParts = [`${ordered.length} ${plural(ordered.length)}`];
    if (totalMin > 0) infoParts.push(`${totalMin} мин.`);
    if (isOwn) infoParts.push(pl.isPublic ? 'Публичный' : 'Приватный');
    els.info.textContent = infoParts.join(' • ');

    /* --- описание --- */
    if (pl.description) {
      els.desc.textContent = pl.description;
      els.desc.style.display = '';
    } else {
      els.desc.style.display = 'none';
    }

    renderActions(pl, ordered, isOwn);
    renderTracks(pl, ordered);
  }

  function resolveOrderedTracks(pl) {
    const lib = window.PocuLibrary.all();
    const map = new Map(lib.map(t => [t.id, t]));
    return (pl.trackIds || []).map(id => map.get(id)).filter(Boolean);
  }

  /* ============ Действия ============ */
  function renderActions(pl, ordered, isOwn) {
    els.actions.replaceChildren();
    const user = window.PocuSupabase?.getUser?.();

    /* 1. Играть всё */
    if (ordered.length) {
      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn-primary';
      playBtn.id = 'plPlayAll';
      playBtn.textContent = 'Играть всё';
      playBtn.addEventListener('click', () => {
        if (ordered.length) window.PocuPlayer.playQueue(ordered, 0);
      });
      els.actions.appendChild(playBtn);

      /* 2. Перемешать */
      const shuffleBtn = document.createElement('button');
      shuffleBtn.className = 'btn btn-secondary';
      shuffleBtn.textContent = 'Перемешать';
      shuffleBtn.addEventListener('click', () => {
        const s = [...ordered].sort(() => Math.random() - 0.5);
        window.PocuPlayer.playQueue(s, 0);
      });
      els.actions.appendChild(shuffleBtn);
    }

    /* 3. Поделиться */
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-secondary';
    shareBtn.textContent = 'Поделиться';
    shareBtn.addEventListener('click', () => {
      const url = window.PocuRouter?.build?.('playlist', pl.id) || location.href;
      const text = `Плейлист «${pl.name}» в Pocu Music`;
      if (window.PocuShare?.share) window.PocuShare.share(url, pl.name, text);
      else if (navigator.share) navigator.share({ title: pl.name, text, url }).catch(()=>{});
    });
    els.actions.appendChild(shareBtn);

    if (isOwn) {
      /* --- владелец: доп. кнопки --- */
      const coverBtn = document.createElement('button');
      coverBtn.className = 'btn btn-secondary';
      coverBtn.textContent = 'Обложка';
      coverBtn.addEventListener('click', pickCover);
      els.actions.appendChild(coverBtn);

      const descBtn = document.createElement('button');
      descBtn.className = 'btn btn-secondary';
      descBtn.textContent = 'Описание';
      descBtn.addEventListener('click', openDescEditor);
      els.actions.appendChild(descBtn);

      const pubBtn = document.createElement('button');
      pubBtn.className = 'btn btn-secondary';
      pubBtn.textContent = pl.isPublic ? 'Скрыть' : 'Опубликовать';
      pubBtn.addEventListener('click', () => togglePublic(pl, user));
      els.actions.appendChild(pubBtn);

      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn btn-secondary';
      renameBtn.textContent = 'Переименовать';
      renameBtn.addEventListener('click', () => {
        const n = prompt('Новое имя:', pl.name);
        if (n && n.trim()) {
          window.PocuStore.playlists.rename(pl.id, n.trim());
          window.PocuSupabase?.syncPlaylistRename(pl.id, n.trim());
          current.data = window.PocuStore.playlists.get(pl.id);
          renderScreen();
        }
      });
      els.actions.appendChild(renameBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-secondary';
      delBtn.textContent = 'Удалить';
      delBtn.style.color = '#ff4d8d';
      delBtn.addEventListener('click', () => {
        ensureConfirmSheet();
        const sh = document.getElementById('sheetConfirmDelete');
        const t = sh.querySelector('#confirmDeleteText');
        const ok = sh.querySelector('#confirmDeleteOk');
        t.textContent = `Плейлист «${pl.name}» будет удалён безвозвратно.`;
        ok.onclick = () => {
          sh.classList.remove('open');
          window.PocuStore.playlists.delete(pl.id);
          window.PocuSupabase?.syncPlaylistDelete(pl.id);
          closeScreen();
        };
        sh.classList.add('open');
      });
      els.actions.appendChild(delBtn);
    } else {
      /* --- чужой: fav-heart --- */
      const isLiked = window.PocuStore.favoritePlaylists.has(pl.id);
      const heart = document.createElement('button');
      heart.type = 'button';
      heart.className = 'fav-heart';
      if (isLiked) heart.classList.add('active');
      heart.setAttribute('aria-label', isLiked ? 'Убрать из избранного' : 'В избранное');
      heart.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20.2s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.2 2.7c0 4.9-7.2 9.3-7.2 9.3z"/>
        </svg>`;
      heart.addEventListener('click', () => {
        if (!user) { toast('Войдите, чтобы сохранять плейлисты'); return; }
        const now = window.PocuStore.favoritePlaylists.has(pl.id);
        if (now) {
          window.PocuStore.favoritePlaylists.remove(pl.id);
          window.PocuSupabase?.syncFavoritePlaylist(pl.id, false);
          heart.classList.remove('active');
          heart.setAttribute('aria-label', 'В избранное');
        } else {
          window.PocuStore.favoritePlaylists.add({
            id: pl.id,
            name: pl.name,
            description: pl.description || '',
            coverUrl: pl.coverUrl || '',
            authorId: pl.authorId,
            authorName: pl.authorName,
            trackIds: (pl.trackIds || []).slice()
          });
          window.PocuSupabase?.syncFavoritePlaylist(pl.id, true);
          heart.classList.add('active');
          heart.setAttribute('aria-label', 'Убрать из избранного');
          heart.classList.add('just-activated');
          setTimeout(() => heart.classList.remove('just-activated'), 450);
        }
      });
      els.actions.appendChild(heart);
    }
  }

  /* ============ Треки ============ */
  function renderTracks(pl, ordered) {
    els.tracks.replaceChildren();
    if (!ordered.length) {
      els.tracks.innerHTML = `<div class="state-block"><div class="state-title">Плейлист пуст</div></div>`;
      return;
    }

    const isOwn = current.mode === 'own';
    const frag = document.createDocumentFragment();
    ordered.forEach((track, i) => {
      frag.appendChild(PocuTrackCard.create(track, {
        index: i,
        showHeart: false,
        showRemove: isOwn,
        onPlay: () => window.PocuPlayer.playQueue(ordered, i),
        onRemove: isOwn ? () => {
          window.PocuStore.playlists.removeTrack(pl.id, track.id);
          window.PocuSupabase?.syncPlaylistTrackRemove(pl.id, track.id);
        } : undefined
      }));
    });
    els.tracks.appendChild(frag);

    PocuTrackCard.syncPlaying(els.tracks, window.PocuPlayer.getState());
    PocuTrackCard.syncHearts(els.tracks, window.PocuStore.favorites.all());
  }

  /* ============ Публичность ============ */
  function togglePublic(pl, user) {
    if (!user) {
      toast('Войдите, чтобы публиковать плейлисты');
      return;
    }
    /* ВАЖНО (бэкап 21.11): nextValue вычисляем ДО update,
       иначе store мутирует ссылку — инверсия даст старое значение. */
    const nextValue = !pl.isPublic;
    if (nextValue && !pl.coverUrl && !pl.description) {
      const ok = confirm('Плейлист будет виден всем в поиске. Продолжить?');
      if (!ok) return;
    }
    window.PocuStore.playlists.update(pl.id, { isPublic: nextValue });
    window.PocuSupabase?.syncPlaylistUpdate(pl.id, { isPublic: nextValue });
    current.data = window.PocuStore.playlists.get(pl.id);
    renderScreen();
  }

  /* ============ Обложка ============ */
  function pickCover() {
    if (!current || current.mode !== 'own') return;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { toast('Файл больше 8 МБ'); return; }
      toast('Загрузка обложки...');
      const url = await window.PocuSupabase?.uploadPlaylistCover?.(current.id, file);
      if (!url) { toast('Не удалось загрузить'); return; }
      window.PocuStore.playlists.update(current.id, { coverUrl: url });
      window.PocuSupabase?.syncPlaylistUpdate(current.id, { coverUrl: url });
      current.data = window.PocuStore.playlists.get(current.id);
      renderScreen();
      toast('Обложка обновлена');
    };
    fileInput.click();
  }

  /* ============ Описание (sheet) ============ */
  function ensureDescSheet() {
    if (document.getElementById('sheetPlaylistDesc')) {
      descSheetEl = document.getElementById('sheetPlaylistDesc');
      return;
    }
    descSheetEl = document.createElement('div');
    descSheetEl.className = 'sheet-overlay';
    descSheetEl.id = 'sheetPlaylistDesc';
    descSheetEl.innerHTML = `
      <div class="sheet-panel">
        <div class="sheet-header"><h2>Описание плейлиста</h2></div>
        <div class="sheet-body">
          <textarea id="playlistDescInput" maxlength="200" placeholder="О чём этот плейлист?" style="width:100%;min-height:120px;resize:vertical;padding:12px;border-radius:12px;border:1px solid var(--glass-brd);background:rgba(255,255,255,.06);color:var(--text);font:inherit;"></textarea>
          <div style="text-align:right;font-size:12px;color:var(--text-dim);margin-top:6px;"><span id="playlistDescCount">0</span>/200</div>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-secondary" id="playlistDescCancel">Отмена</button>
          <button class="btn btn-primary" id="playlistDescSave">Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(descSheetEl);
    descSheetEl.addEventListener('click', e => { if (e.target === descSheetEl) descSheetEl.classList.remove('open'); });
    descSheetEl.querySelector('#playlistDescCancel').addEventListener('click', () => descSheetEl.classList.remove('open'));
    descSheetEl.querySelector('#playlistDescInput').addEventListener('input', e => {
      descSheetEl.querySelector('#playlistDescCount').textContent = e.target.value.length;
    });
  }

  function openDescEditor() {
    if (!current || current.mode !== 'own') return;
    ensureDescSheet();
    const ta = descSheetEl.querySelector('#playlistDescInput');
    ta.value = current.data.description || '';
    descSheetEl.querySelector('#playlistDescCount').textContent = ta.value.length;
    descSheetEl.classList.add('open');
    setTimeout(() => ta.focus(), 100);
    descSheetEl.querySelector('#playlistDescSave').onclick = () => {
      const text = ta.value.trim();
      window.PocuStore.playlists.update(current.id, { description: text });
      window.PocuSupabase?.syncPlaylistUpdate(current.id, { description: text });
      current.data = window.PocuStore.playlists.get(current.id);
      descSheetEl.classList.remove('open');
      renderScreen();
    };
  }

  /* ============ Confirm sheet ============ */
  function ensureConfirmSheet() {
    if (document.getElementById('sheetConfirmDelete')) return;
    const s = document.createElement('div');
    s.className = 'sheet-overlay';
    s.id = 'sheetConfirmDelete';
    s.innerHTML = `
      <div class="sheet-panel">
        <div class="sheet-header"><h2>Удалить плейлист?</h2></div>
        <div class="sheet-body"><p id="confirmDeleteText" style="font-size:14px;line-height:1.5;color:var(--text-dim);margin:0"></p></div>
        <div class="sheet-actions">
          <button class="btn btn-secondary" id="confirmDeleteCancel">Отмена</button>
          <button class="btn btn-primary" id="confirmDeleteOk">Удалить</button>
        </div>
      </div>`;
    document.body.appendChild(s);
    s.addEventListener('click', e => { if (e.target === s) s.classList.remove('open'); });
    s.querySelector('#confirmDeleteCancel').addEventListener('click', () => s.classList.remove('open'));
  }

  /* ============ helpers ============ */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function escapeAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }
  function toast(t) {
    let el = document.getElementById('pocuToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pocuToast';
      el.className = 'pulse-toast';
      document.body.appendChild(el);
    }
    el.textContent = t;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2000);
  }

  return {
    init,
    openPlaylistScreen,
    openPlaylist,
    closePlaylistScreen: closeScreen,
    renderPlaylists
  };
})();