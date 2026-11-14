/* Pocu Music — UI для плейлистов */
window.PocuPlaylistsUI = (() => {
  let $libPlaylists, $sheet, $sheetInput, $sheetCreateBtn, $sheetCancelBtn;
  let $playlistScreen, $playlistTitle, $playlistActions, $playlistTracks;
  let currentPlaylistId = null;
  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    $libPlaylists = document.getElementById('libPlaylists');
    $sheet = document.getElementById('sheet-create-playlist');
    $sheetInput = document.getElementById('sheetPlaylistName');
    $sheetCreateBtn = document.getElementById('sheetCreateBtn');
    $sheetCancelBtn = document.getElementById('sheetCancelBtn');

    $playlistScreen = document.getElementById('playlistScreen');
    $playlistTitle = document.getElementById('playlistTitle');
    $playlistActions = document.getElementById('playlistActions');
    $playlistTracks = document.getElementById('playlistTracks');

    document.getElementById('createPlaylistBtn')?.addEventListener('click', openSheet);
    $sheetCancelBtn?.addEventListener('click', closeSheet);
    $sheetCreateBtn?.addEventListener('click', createPlaylist);

    $sheet?.addEventListener('click', (e) => {
      if (e.target === $sheet) closeSheet();
    });

    document.getElementById('playlistBackBtn')?.addEventListener('click', closePlaylistScreen);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && currentPlaylistId) closePlaylistScreen();
    });

    window.PocuStore.subscribe(state => {
      renderPlaylists(state.playlists);
      if (currentPlaylistId) renderPlaylistScreen(currentPlaylistId);
    });

    window.PocuPlayer.subscribe(state => {
      if (currentPlaylistId) PocuTrackCard.syncPlaying($playlistTracks, state);
    });
  }

  /* ---------- Плейлисты тайлами ---------- */
  function renderPlaylists(playlists) {
    $libPlaylists.replaceChildren();

    if (!playlists.length) {
      $libPlaylists.innerHTML = '<p class="hint">У тебя пока нет плейлистов</p>';
      return;
    }

    playlists.forEach(pl => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'home-tile';
      el.dataset.playlistId = pl.id;

      const artWrap = document.createElement('div');
      artWrap.className = 'home-tile-art-wrap';

      const art = document.createElement('div');
      art.className = 'home-tile-art';
      const first = pl.trackIds[0] ? window.PocuLibrary.get(pl.trackIds[0]) : null;
      if (first && first.artwork) {
        art.style.backgroundImage = `url("${first.artwork}")`;
      } else {
        art.classList.add('home-tile-art--placeholder');
      }
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
      count.textContent = `${pl.trackIds.length} ${plural(pl.trackIds.length)}`;

      text.append(name, count);
      info.appendChild(text);
      el.append(artWrap, info);

      el.addEventListener('click', () => openPlaylistScreen(pl.id));
      $libPlaylists.appendChild(el);
    });
  }

  function plural(n) {
    const m = n % 100;
    if (m >= 11 && m <= 14) return 'треков';
    const l = n % 10;
    if (l === 1) return 'трек';
    if (l >= 2 && l <= 4) return 'трека';
    return 'треков';
  }

  /* ---------- Sheet для создания ---------- */
  function openSheet() {
    $sheetInput.value = '';
    $sheet.classList.add('open');
    setTimeout(() => $sheetInput.focus(), 100);
  }

  function closeSheet() {
    $sheet.classList.remove('open');
    $sheetInput.blur();
  }

  function createPlaylist() {
    const name = $sheetInput.value.trim();
    if (!name) { $sheetInput.focus(); return; }
    const pl = window.PocuStore.playlists.create(name);
    window.PocuSupabase?.syncPlaylistCreate(pl);
    closeSheet();
  }

  /* ---------- Экран плейлиста ---------- */
  function openPlaylistScreen(playlistId) {
    const pl = window.PocuStore.playlists.get(playlistId);
    if (!pl) return;

    currentPlaylistId = playlistId;
    window.PocuRouter?.setHash?.('playlist', playlistId);
    $playlistTitle.textContent = pl.name;
    renderPlaylistScreen(playlistId);

    $playlistScreen.classList.add('open');
    $playlistScreen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('playlist-open');

    requestAnimationFrame(() => { $playlistScreen.scrollTop = 0; });
  }

  function closePlaylistScreen() {
    currentPlaylistId = null;
    window.PocuRouter?.clearHash?.();
    $playlistScreen.classList.remove('open');
    $playlistScreen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('playlist-open');
  }

  function renderPlaylistScreen(playlistId) {
    const pl = window.PocuStore.playlists.get(playlistId);
    if (!pl) return;

    const allTracks = window.PocuLibrary.all();
    const map = new Map(allTracks.map(t => [t.id, t]));
    const ordered = pl.trackIds.map(id => map.get(id)).filter(Boolean);

    $playlistTracks.replaceChildren();

    if (!ordered.length) {
      $playlistTracks.innerHTML = `
        <div class="state-block">
          <div class="state-title">Плейлист пуст</div>
          <div class="state-sub">Добавляй треки через контекстное меню</div>
        </div>`;
    } else {
      const frag = document.createDocumentFragment();
      ordered.forEach((track, i) => {
        frag.appendChild(PocuTrackCard.create(track, {
          index: i,
          showHeart: false,
          showRemove: true,
          onPlay: () => window.PocuPlayer.playQueue(ordered, i),
          onRemove: () => {
            window.PocuStore.playlists.removeTrack(pl.id, track.id);
            window.PocuSupabase?.syncPlaylistTrackRemove(pl.id, track.id);
          }
        }));
      });
      $playlistTracks.appendChild(frag);
    }

    $playlistActions.innerHTML = `
      <button class="btn btn-primary" id="plPlayAll">Играть всё</button>
      <button class="btn btn-secondary" id="plShuffle">Перемешать</button>
      <button class="btn btn-secondary" id="plShare">Поделиться</button>
      <button class="btn btn-secondary" id="plRename">Переименовать</button>
      <button class="btn btn-secondary" id="plDelete" style="color: #ff4d8d;">Удалить</button>
    `;

    document.getElementById('plPlayAll').addEventListener('click', () => {
      if (ordered.length) window.PocuPlayer.playQueue(ordered, 0);
    });
    document.getElementById('plShuffle').addEventListener('click', () => {
      if (!ordered.length) return;
      const shuffled = [...ordered].sort(() => Math.random() - 0.5);
      window.PocuPlayer.playQueue(shuffled, 0);
    });
    document.getElementById('plShare').addEventListener('click', () => {
      const url = window.PocuRouter?.build?.('playlist', pl.id) || window.location.href;
      const text = `Плейлист «${pl.name}» в Pocu Music`;
      if (window.PocuShare?.share) {
        window.PocuShare.share(url, pl.name, text);
      } else if (navigator.share) {
        navigator.share({ title: pl.name, text, url }).catch(() => {});
      }
    });
    document.getElementById('plRename').addEventListener('click', () => {
      const newName = prompt('Новое имя плейлиста:', pl.name);
      if (newName && newName.trim()) {
        window.PocuStore.playlists.rename(pl.id, newName.trim());
        window.PocuSupabase?.syncPlaylistRename(pl.id, newName.trim());
        $playlistTitle.textContent = newName.trim();
      }
    });
    document.getElementById('plDelete').addEventListener('click', () => {
      if (confirm(`Удалить плейлист "${pl.name}"?`)) {
        window.PocuStore.playlists.delete(pl.id);
        window.PocuSupabase?.syncPlaylistDelete(pl.id);
        closePlaylistScreen();
      }
    });

    PocuTrackCard.syncPlaying($playlistTracks, window.PocuPlayer.getState());
  }

  return { init, openPlaylistScreen, closePlaylistScreen };
})();