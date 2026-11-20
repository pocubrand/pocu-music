/* Pocu Music — UI плейлистов: свой + публичный, обложка, описание, публичность */
window.PocuPlaylistsUI = (() => {
  let els = {};
  let initialized = false;
  let current = null;        // { id, mode: 'own'|'public', data }
  let descSheetEl = null;

  function init() {
    if (initialized) return;
    initialized = true;

    els = {
      libPlaylists:    document.getElementById('libPlaylists'),
      sheet:           document.getElementById('sheet-create-playlist'),
      sheetInput:      document.getElementById('sheetPlaylistName'),
      sheetCreateBtn:  document.getElementById('sheetCreateBtn'),
      sheetCancelBtn:  document.getElementById('sheetCancelBtn'),
      screen:          document.getElementById('playlistScreen'),
      banner:          document.getElementById('playlistBanner'),
      title:           document.getElementById('playlistTitle'),
      actions:         document.getElementById('playlistActions'),
      tracks:          document.getElementById('playlistTracks')
    };

    document.getElementById('createPlaylistBtn')?.addEventListener('click', openSheet);
    els.sheetCancelBtn?.addEventListener('click', closeSheet);
    els.sheetCreateBtn?.addEventListener('click', createPlaylist);
    els.sheet?.addEventListener('click', e => { if (e.target === els.sheet) closeSheet(); });
    document.getElementById('playlistBackBtn')?.addEventListener('click', closeScreen);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && current) closeScreen();
    });

    window.PocuStore.subscribe(state => {
      renderPlaylists(state.playlists);
      if (current && current.mode === 'own') renderScreen();
    });
    window.PocuPlayer.subscribe(state => {
      if (current) PocuTrackCard.syncPlaying(els.tracks, state);
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
      authorName: window.PocuStore.profile.get().displayName || (user?.email || '').split('@')[0] || ''
    });
    window.PocuSupabase?.syncPlaylistCreate(pl);
    closeSheet();
  }

  /* ============ Открытие плейлиста ============ */
  function openPlaylist(id, mode) {
    if (mode === 'own') {
      const pl = window.PocuStore.playlists.get(id);
      if (!pl) return;
      current = { id, mode: 'own', data: pl };
    } else {
      // public: из кэша или с сервера
      const cached = window.PocuStore.favoritePlaylists.get(id);
      current = { id, mode: 'public', data: cached || null, loading: !cached };
    }
    window.PocuRouter?.setHash?.('playlist', id);
    els.screen.classList.add('open');
    els.screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('playlist-open');
    window.PocuLayers?.front?.(els.screen);
    els.screen.querySelector('.playlist-overlay-inner')?.scrollTo({ top: 0 });
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
      // Обновим локальный кэш если он был лайкнут
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
      els.banner.innerHTML = '<div class="playlist-banner-loading"><div class="playlist-banner-cover shimmer"></div><div style="flex:1"><div class="shimmer" style="height:20px;width:60%;margin-bottom:10px"></div><div class="shimmer" style="height:14px;width:40%"></div></div></div>';
      els.actions.innerHTML = '';
      els.tracks.innerHTML = '';
      return;
    }
    if (!current.data) {
      els.banner.innerHTML = '';
      els.actions.innerHTML = '';
      els.tracks.innerHTML = `
        <div class="state-block">
          <div class="state-title">${navigator.onLine ? 'Плейлист не найден' : 'Нет соединения'}</div>
          <div class="state-sub">${navigator.onLine ? 'Возможно, он был удалён или стал приватным' : 'Публичные плейлисты недоступны офлайн'}</div>
        </div>`;
      return;
    }

    const pl = current.data;
    const isOwn = current.mode === 'own';
    const user = window.PocuSupabase?.getUser?.();
    const isLiked = !isOwn && window.PocuStore.favoritePlaylists.has(pl.id);

    /* --- banner --- */
    const coverHtml = pl.coverUrl
      ? `<div class="playlist-banner-cover" style="background-image:url('${escapeAttr(pl.coverUrl)}')"></div>`
      : (() => {
          const first = pl.trackIds[0] ? window.PocuLibrary.get(pl.trackIds[0]) : null;
          if (first?.artwork) return `<div class="playlist-banner-cover" style="background-image:url('${escapeAttr(first.artwork)}')"></div>`;
          return `<div class="playlist-banner-cover playlist-banner-cover--gradient"><span>${escapeHtml((pl.name || '?').slice(0,1).toUpperCase())}</span></div>`;
        })();

    const publicLabel = pl.isPublic ? 'Публичный' : 'Приватный';

    els.banner.innerHTML = `
      <div class="playlist-banner-row">
        ${coverHtml}
        <div class="playlist-banner-meta">
          <div class="playlist-banner-name">${escapeHtml(pl.name)}</div>
          <div class="playlist-banner-sub">
            ${!isOwn ? `<span class="playlist-banner-author">${escapeHtml(pl.authorName || 'Аноним')}</span> · ` : ''}
            ${pl.trackIds.length} ${plural(pl.trackIds.length)}
            ${isOwn ? ` · <span class="playlist-banner-status">${publicLabel}</span>` : ''}
          </div>
          ${pl.description ? `<div class="playlist-banner-desc">${escapeHtml(pl.description)}</div>` : ''}
        </div>
      </div>
      ${isOwn ? `
        <div class="playlist-banner-controls">
          <button class="btn btn-secondary" id="pbChangeCover" type="button">Обложка</button>
          <button class="btn btn-secondary" id="pbEditDesc" type="button">Описание</button>
          <button class="btn btn-secondary" id="pbTogglePublic" type="button">
            ${pl.isPublic ? 'Скрыть' : 'Опубликовать'}
          </button>
        </div>
      ` : `
        <div class="playlist-banner-controls">
          <button class="btn ${isLiked ? 'btn-secondary' : 'btn-primary'}" id="pbLike" type="button">
            ${isLiked ? '♥ В избранном' : '♡ В избранное'}
          </button>
        </div>
      `}
    `;

    if (isOwn) {
      els.banner.querySelector('#pbChangeCover')?.addEventListener('click', pickCover);
      els.banner.querySelector('#pbEditDesc')?.addEventListener('click', openDescEditor);
      els.banner.querySelector('#pbTogglePublic')?.addEventListener('click', () => {
        if (!user) {
          toast('Войдите, чтобы публиковать плейлисты');
          return;
        }
        if (!pl.coverUrl && !pl.description) {
          const ok = confirm('Плейлист будет виден всем в поиске. Продолжить?');
          if (!ok) return;
        }
        window.PocuStore.playlists.update(pl.id, { isPublic: !pl.isPublic });
        window.PocuSupabase?.syncPlaylistUpdate(pl.id, { isPublic: !pl.isPublic });
        renderScreen();
      });
    } else {
      els.banner.querySelector('#pbLike')?.addEventListener('click', () => {
        if (!user) { toast('Войдите, чтобы сохранять плейлисты'); return; }
        if (window.PocuStore.favoritePlaylists.has(pl.id)) {
          window.PocuStore.favoritePlaylists.remove(pl.id);
          window.PocuSupabase?.syncFavoritePlaylist(pl.id, false);
        } else {
          window.PocuStore.favoritePlaylists.add({
            id: pl.id, name: pl.name, description: pl.description || '',
            coverUrl: pl.coverUrl || '', authorId: pl.authorId, authorName: pl.authorName,
            trackIds: pl.trackIds.slice()
          });
          window.PocuSupabase?.syncFavoritePlaylist(pl.id, true);
        }
        renderScreen();
      });
    }

    /* --- tracks --- */
    const lib = window.PocuLibrary.all();
    const map = new Map(lib.map(t => [t.id, t]));
    const ordered = pl.trackIds.map(id => map.get(id)).filter(Boolean);

    els.tracks.replaceChildren();
    if (!ordered.length) {
      els.tracks.innerHTML = `<div class="state-block"><div class="state-title">Плейлист пуст</div></div>`;
    } else {
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
    }

    /* --- actions --- */
    const actions = [];
    actions.push(`<button class="btn btn-primary" id="plPlayAll" type="button">Играть всё</button>`);
    actions.push(`<button class="btn btn-secondary" id="plShuffle" type="button">Перемешать</button>`);
    actions.push(`<button class="btn btn-secondary" id="plShare" type="button">Поделиться</button>`);
    if (isOwn) {
      actions.push(`<button class="btn btn-secondary" id="plRename" type="button">Переименовать</button>`);
      actions.push(`<button class="btn btn-secondary" id="plDelete" type="button" style="color:#ff4d8d;">Удалить</button>`);
    }
    els.actions.innerHTML = actions.join('');

    els.actions.querySelector('#plPlayAll')?.addEventListener('click', () => {
      if (ordered.length) window.PocuPlayer.playQueue(ordered, 0);
    });
    els.actions.querySelector('#plShuffle')?.addEventListener('click', () => {
      if (!ordered.length) return;
      const sh = [...ordered].sort(() => Math.random() - 0.5);
      window.PocuPlayer.playQueue(sh, 0);
    });
    els.actions.querySelector('#plShare')?.addEventListener('click', () => {
      const url = window.PocuRouter?.build?.('playlist', pl.id) || location.href;
      const text = `Плейлист «${pl.name}» в Pocu Music`;
      if (window.PocuShare?.share) window.PocuShare.share(url, pl.name, text);
      else if (navigator.share) navigator.share({ title: pl.name, text, url }).catch(()=>{});
    });
    els.actions.querySelector('#plRename')?.addEventListener('click', () => {
      const n = prompt('Новое имя:', pl.name);
      if (n && n.trim()) {
        window.PocuStore.playlists.rename(pl.id, n.trim());
        window.PocuSupabase?.syncPlaylistRename(pl.id, n.trim());
        current.data.name = n.trim();
        renderScreen();
      }
    });
    els.actions.querySelector('#plDelete')?.addEventListener('click', () => {
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

    PocuTrackCard.syncPlaying(els.tracks, window.PocuPlayer.getState());
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
    if (document.getElementById('sheetPlaylistDesc')) { descSheetEl = document.getElementById('sheetPlaylistDesc'); return; }
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
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function escapeAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }
  function toast(t) {
    let el = document.getElementById('pocuToast');
    if (!el) { el = document.createElement('div'); el.id = 'pocuToast'; el.className = 'pulse-toast'; document.body.appendChild(el); }
    el.textContent = t;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2000);
  }

  return { init, openPlaylistScreen, openPlaylist, closePlaylistScreen: closeScreen, renderPlaylists };
})();