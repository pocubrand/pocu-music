/* Pocu Music — экран «Профиль» (entity layout v2) */
window.PocuProfileUI = (() => {
  let els = {};
  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    els = {
      guest:       document.getElementById('profileGuest'),
      content:     document.getElementById('profileContent'),
      loginBtn:    document.getElementById('profileLoginBtn'),
      avatar:      document.getElementById('profileAvatar'),
      displayName: document.getElementById('profileDisplayName'),
      email:       document.getElementById('profileEmail'),
      info:        document.getElementById('profileInfo'),
      actions:     document.getElementById('profileActions'),
      stats:       document.getElementById('profileStats'),
      favArtist:   document.getElementById('profileFavArtist'),
      favGenre:    document.getElementById('profileFavGenre')
    };

    els.loginBtn?.addEventListener('click', () => window.PocuAuthUI?.openAuthSheet?.());

    document.addEventListener('pocu:auth', render);
    window.PocuStore.subscribe(() => render());
    render();
  }

  function render() {
    const user = window.PocuSupabase?.getUser?.();
    const loggedIn = !!user;

    els.guest.hidden = loggedIn;
    els.content.hidden = !loggedIn;
    if (!loggedIn) return;

    const prof = window.PocuStore.profile.get();
    els.displayName.textContent = prof.displayName
      || (user.email ? user.email.split('@')[0] : 'Без имени');
    els.email.textContent = user.email || '';

    /* --- аватар --- */
    if (prof.avatarUrl) {
      els.avatar.style.backgroundImage = `url("${prof.avatarUrl}")`;
      els.avatar.textContent = '';
    } else {
      els.avatar.style.backgroundImage = '';
      els.avatar.textContent = (prof.displayName || user.email || '?').slice(0, 1).toUpperCase();
    }

    /* --- счётчики --- */
    const favCount    = window.PocuStore.favorites.all().length;
    const albumCount  = window.PocuStore.favoriteAlbums.all().length;
    const artistCount = window.PocuStore.favoriteArtists.all().length;
    const plCount     = window.PocuStore.playlists.all().length;

    let totalPlays = 0;
    const byArtist = new Map();
    const byGenre  = new Map();
    const stats = window.PocuStore.skipStats.all();
    const lib = window.PocuLibrary.all();
    const map = new Map(lib.map(t => [t.id, t]));

    for (const [id, s] of Object.entries(stats)) {
      const plays = s.plays || 0;
      totalPlays += plays;
      const t = map.get(id);
      if (!t || !plays) continue;
      if (t.artist) byArtist.set(t.artist, (byArtist.get(t.artist) || 0) + plays);
      if (t.genre)  byGenre.set(t.genre,   (byGenre.get(t.genre)   || 0) + plays);
    }

    const topArtist = [...byArtist.entries()].sort((a, b) => b[1] - a[1])[0];
    const topGenre  = [...byGenre.entries()].sort((a, b) => b[1] - a[1])[0];

    /* --- инфо-строка --- */
    if (els.info) {
      if (user.created_at) {
        const year = new Date(user.created_at).getFullYear();
        els.info.textContent = `В Pocu Music с ${year}`;
      } else {
        els.info.textContent = '';
      }
    }

    /* --- кнопка «Настройки» --- */
    if (els.actions) {
      els.actions.innerHTML = '';
      const settingsBtn = document.createElement('button');
      settingsBtn.type = 'button';
      settingsBtn.className = 'btn btn-secondary';
      settingsBtn.textContent = 'Настройки профиля';
      settingsBtn.addEventListener('click', () => {
        const trigger = document.getElementById('settingsBtn')
                     || document.getElementById('sidebarSettingsBtn');
        trigger?.click();
      });
      els.actions.appendChild(settingsBtn);
    }

    /* --- сетка статистики --- */
    els.stats.innerHTML = `
      <div class="profile-stat-card">
        <div class="profile-stat-value">${favCount}</div>
        <div class="profile-stat-label">Треков в избранном</div>
      </div>
      <div class="profile-stat-card">
        <div class="profile-stat-value">${albumCount}</div>
        <div class="profile-stat-label">Альбомов</div>
      </div>
      <div class="profile-stat-card">
        <div class="profile-stat-value">${artistCount}</div>
        <div class="profile-stat-label">Артистов</div>
      </div>
      <div class="profile-stat-card">
        <div class="profile-stat-value">${plCount}</div>
        <div class="profile-stat-label">Плейлистов</div>
      </div>
      <div class="profile-stat-card">
        <div class="profile-stat-value">${totalPlays}</div>
        <div class="profile-stat-label">Прослушано</div>
      </div>
    `;

    /* --- вкусы --- */
    els.favArtist.textContent = topArtist ? `${topArtist[0]} · ${topArtist[1]} прослуш.` : '—';
    els.favGenre.textContent  = topGenre  ? `${topGenre[0]} · ${topGenre[1]} прослуш.` : '—';
  }

  return { init };
})();