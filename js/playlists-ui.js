/* Pocu Music — UI плейлистов (entity layout v2) */
window.PocuPlaylistsUI = (() => {
  let els = {};
  let initialized = false;
  let current = null;           // { id, mode: 'own'|'public', data, loading? }
  let descSheetEl = null;
  let plMenuOverlay = null;
  let plMenu = null;

  const ICON_EDIT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const ICON_MORE = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>';

  function init() {
    if (initialized) return;
    initialized = true;

    /* --- Экран --- */
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
          <div class="entity-cover-wrap" id="playlistCoverWrap">
            <div class="entity-cover" id="playlistCover"></div>
            <button class="cover-edit-btn" id="playlistCoverEdit" type="button" aria-label="Сменить обложку">${ICON_EDIT}</button>
          </div>
          <div class="entity-meta">
            <div class="entity-type" id="playlistType">Плейлист</div>
            <h1 class="entity-title" id="playlistTitle">
              <span class="entity-title-text" id="playlistTitleText">—</span>
              <button class="inline-edit-btn" id="playlistTitleEdit" type="button" aria-label="Переименовать">${ICON_EDIT}</button>
            </h1>
            <div class="entity-sub" id="playlistAuthor"></div>
            <div class="entity-info" id="playlistInfo"></div>
            <div class="entity-info entity-info--desc" id="playlistDesc">
              <span class="entity-desc-text" id="playlistDescText"></span>
              <button class="inline-edit-btn" id="playlistDescEdit" type="button" aria-label="Изменить описание">${ICON_EDIT}</button>
            </div>
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
      coverWrap:      screen.querySelector('#playlistCoverWrap'),
      cover:          screen.querySelector('#playlistCover'),
      coverEdit:      screen.querySelector('#playlistCoverEdit'),
      type:           screen.querySelector('#playlistType'),
      title:          screen.querySelector('#playlistTitle'),
      titleText:      screen.querySelector('#playlistTitleText'),
      titleEdit:      screen.querySelector('#playlistTitleEdit'),
      author:         screen.querySelector('#playlistAuthor'),
      info:           screen.querySelector('#playlistInfo'),
      desc:           screen.querySelector('#playlistDesc'),
      descText:       screen.querySelector('#playlistDescText'),
      descEdit:       screen.querySelector('#playlistDescEdit'),
      actions:        screen.querySelector('#playlistActions'),
      tracks:         screen.querySelector('#playlistTracks')
    };

    document.getElementById('createPlaylistBtn')?.addEventListener('click', openSheet);
    els.sheetCancelBtn?.addEventListener('click', closeSheet);
    els.sheetCreateBtn?.addEventListener('click', createPlaylist);
    els.sheet?.addEventListener('click', e => { if (e.target === els.sheet) closeSheet(); });
    els.back.addEventListener('click', closeScreen);

    /* --- Inline edit: обложка --- */
    els.cover.addEventListener('click', () => {
      if (current?.mode === 'own') pickCover();
    });
    els.coverEdit.addEventListener('click', e => {
      e.stopPropagation();
      if (current?.mode === 'own') pickCover();
    });

    /* --- Inline edit: название --- */
    els.titleEdit.addEventListener('click', e => {
      e.stopPropagation();
      if (current?.mode === 'own') renamePrompt();
    });
    els.title.addEventListener('click', e => {
      if (current?.mode !== 'own') return;
      if (els.titleEdit.contains(e.target)) return;
      renamePrompt();
    });

    /* --- Inline edit: описание --- */
    els.descEdit.addEventListener('click', e => {
      e.stopPropagation();
      if (current?.mode === 'own') openDescEditor();
    });
    els.desc.addEventListener('click', e => {
      if (current?.mode !== 'own') return;
      if (els.descEdit.contains(e.target)) return;
      openDescEditor();
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (plMenuOverlay?.classList.contains('open')) { closePlaylistMenu(); return; }
      if (current) closeScreen();
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

    window.addEventListener('online',  () => { if (current?.mode === 'public') refreshPublic(); });
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
      els.titleText.textContent = '—';
      els.author.textContent = '';
      els.author.style.display = 'none';
      els.info.innerHTML = '<div class="shimmer" style="height:14px;width:60%"></div>';
      els.desc.style.display = 'none';
      els.cover.style.backgroundImage = '';
      els.cover.style.background = '';
      els.cover.textContent = '';
      els.coverEdit.style.display = 'none';
      els.titleEdit.style.display = 'none';
      els.descEdit.style.display = 'none';
      els.actions.innerHTML = '';
      els.tracks.innerHTML = '';
      return;
    }

    if (!current.data) {
      els.type.textContent = 'Плейлист';
      els.titleText.textContent = navigator.onLine ? 'Плейлист не найден' : 'Нет соединения';
      els.author.textContent = '';
      els.author.style.display = 'none';
      els.info.textContent = navigator.onLine
        ? 'Возможно, он был удалён или стал приватным'
        : 'Публичные плейлисты недоступны офлайн';
      els.desc.style.display = 'none';
      els.cover.style.backgroundImage = '';
      els.cover.style.background = '';
      els.cover.textContent = '?';
      els.coverEdit.style.display = 'none';
      els.titleEdit.style.display = 'none';
      els.descEdit.style.display = 'none';
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
      els.cover.style.background = '';
      els.cover.style.backgroundImage = `url("${coverSrc}")`;
      els.cover.textContent = '';
    } else {
      els.cover.style.backgroundImage = '';
      els.cover.style.background = 'linear-gradient(135deg, #7c5cff, #ff409e)';
      els.cover.textContent = (pl.name || '?').slice(0, 1).toUpperCase();
    }

    /* --- тип / название / автор --- */
    els.type.textContent = isOwn ? 'Мой плейлист' : 'Плейлист';
    els.titleText.textContent = pl.name || 'Без названия';

    if (!isOwn) {
      els.author.textContent = pl.authorName || 'Аноним';
      els.author.style.display = '';
    } else {
      els.author.textContent = '';
      els.author.style.display = 'none';
    }

    /* --- инфо --- */
    const ordered = resolveOrderedTracks(pl);
    const totalSec = ordered.reduce((s, t) => s + (t.duration || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    const infoParts = [`${ordered.length} ${plural(ordered.length)}`];
    if (totalMin > 0) infoParts.push(`${totalMin} мин.`);
    if (isOwn) infoParts.push(pl.isPublic ? 'Публичный' : 'Приватный');
    els.info.textContent = infoParts.join(' • ');

    /* --- описание --- */
    if (pl.description) {
      els.descText.textContent = pl.description;
      els.descText.classList.remove('is-empty');
      els.desc.style.display = '';
    } else if (isOwn) {
      els.descText.textContent = 'Добавить описание';
      els.descText.classList.add('is-empty');
      els.desc.style.display = '';
    } else {
      els.desc.style.display = 'none';
    }

    /* --- inline-кнопки только у владельца --- */
    els.coverEdit.style.display = isOwn ? '' : 'none';
    els.titleEdit.style.display = isOwn ? '' : 'none';
    els.descEdit.style.display  = isOwn ? '' : 'none';
    els.cover.style.cursor     = isOwn ? 'pointer' : '';
    els.titleText.style.cursor = isOwn ? 'pointer' : '';
    els.descText.style.cursor  = isOwn ? 'pointer' : '';

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

    /* Play all */
    if (ordered.length) {
      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn-primary';
      playBtn.textContent = 'Играть всё';
      playBtn.addEventListener('click', () => {
        if (ordered.length) window.PocuPlayer.playQueue(ordered, 0);
      });
      els.actions.appendChild(playBtn);

      const shuffleBtn = document.createElement('button');
      shuffleBtn.className = 'btn btn-secondary';
      shuffleBtn.textContent = 'Перемешать';
      shuffleBtn.addEventListener('click', () => {
        const s = [...ordered].sort(() => Math.random() - 0.5);
        window.PocuPlayer.playQueue(s, 0);
      });
      els.actions.appendChild(shuffleBtn);
    }

    /* [...] — контекстное меню */
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'entity-menu';
    moreBtn.setAttribute('aria-label', 'Ещё');
    moreBtn.innerHTML = ICON_MORE;
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      openPlaylistMenu(moreBtn, pl, isOwn, user);
    });
    els.actions.appendChild(moreBtn);

    /* Лайк — только для чужого */
    if (!isOwn) {
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
        const wasLiked = window.PocuStore.favoritePlaylists.has(pl.id);
        if (wasLiked) {
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

  /* ============ Inline edit: переименование ============ */
  function renamePrompt() {
    if (!current || current.mode !== 'own' || !current.data) return;
    const n = prompt('Новое имя:', current.data.name || '');
    if (!n) return;
    const v = n.trim();
    if (!v || v === current.data.name) return;
    window.PocuStore.playlists.rename(current.id, v);
    window.PocuSupabase?.syncPlaylistRename(current.id, v);
    current.data = window.PocuStore.playlists.get(current.id);
    renderScreen();
  }

  /* ============ Публичность ============ */
  function togglePublic(pl, user) {
    if (!user) {
      toast('Войдите, чтобы публиковать плейлисты');
      return;
    }
    /* ВАЖНО: nextValue вычисляем ДО update (store мутирует ссылку) */
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
    if (!current || current.mode !== 'own' || !current.data) return;
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

  /* ============ Контекст-меню [...] ============ */
  function ensurePlaylistMenu() {
    if (document.getElementById('playlistContextOverlay')) return;
    plMenuOverlay = document.createElement('div');
    plMenuOverlay.className = 'context-overlay';
    plMenuOverlay.id = 'playlistContextOverlay';
    plMenu = document.createElement('div');
    plMenu.className = 'context-menu';
    plMenu.id = 'playlistContextMenu';
    plMenu.setAttribute('role', 'menu');
    plMenuOverlay.appendChild(plMenu);
    document.body.appendChild(plMenuOverlay);

    plMenuOverlay.addEventListener('click', e => {
      if (e.target === plMenuOverlay) closePlaylistMenu();
    });
  }

  function openPlaylistMenu(anchor, pl, isOwn, user) {
    ensurePlaylistMenu();

    const items = [];
    if (isOwn) {
      items.push({ action: 'toggle-public', label: pl.isPublic ? 'Скрыть из поиска' : 'Опубликовать' });
    }
    items.push({ action: 'share', label: 'Поделиться' });
    if (isOwn) {
      items.push({ action: 'delete', label: 'Удалить плейлист', danger: true });
    }

    plMenu.innerHTML = items.map(it => `
      <button class="context-item" data-action="${it.action}">
        <span class="context-label"${it.danger ? ' style="color:#ff4d8d"' : ''}>${escapeHtml(it.label)}</span>
      </button>
    `).join('');

    plMenu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.action;
        closePlaylistMenu();
        if (a === 'toggle-public') togglePublic(pl, user);
        else if (a === 'share')    sharePlaylist(pl);
        else if (a === 'delete')   confirmDeletePlaylist(pl);
      });
    });

    plMenuOverlay.classList.add('open');
    positionPlaylistMenu(anchor);
  }

  function positionPlaylistMenu(anchor) {
    const m = 16, vw = window.innerWidth, vh = window.innerHeight;

    plMenu.style.left = '0px';
    plMenu.style.top = '0px';
    plMenu.style.maxHeight = '';
    plMenu.style.overflowY = '';

    const r1 = plMenu.getBoundingClientRect();
    if (r1.height > vh - 2 * m) {
      plMenu.style.maxHeight = (vh - 2 * m) + 'px';
      plMenu.style.overflowY = 'auto';
    }

    const rect = plMenu.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();

    let left = a.right - rect.width;
    if (left < m) left = m;
    if (left + rect.width > vw - m) left = vw - rect.width - m;

    let top = a.bottom + 6;
    if (top + rect.height > vh - m) {
      top = a.top - rect.height - 6;
      if (top < m) top = m;
    }

    plMenu.style.left = left + 'px';
    plMenu.style.top  = top + 'px';
  }

  function closePlaylistMenu() {
    plMenuOverlay?.classList.remove('open');
  }

  function sharePlaylist(pl) {
    const url = window.PocuRouter?.build?.('playlist', pl.id) || location.href;
    const text = `Плейлист «${pl.name}» в Pocu Music`;
    if (window.PocuShare?.share) window.PocuShare.share(url, pl.name, text);
    else if (navigator.share) navigator.share({ title: pl.name, text, url }).catch(() => {});
  }

  function confirmDeletePlaylist(pl) {
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
  }

  /* ============ helpers ============ */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
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