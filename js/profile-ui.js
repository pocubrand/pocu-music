/* Pocu Music — экран «Профиль» (только просмотр) */
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
    els.email.textContent = user.email || '';
    els.displayName.textContent = prof.displayName || (user.email ? user.email.split('@')[0] : 'Без имени');

    if (prof.avatarUrl) {
      els.avatar.style.backgroundImage = `url("${prof.avatarUrl}")`;
      els.avatar.textContent = '';
    } else {
      els.avatar.style.backgroundImage = '';
      els.avatar.textContent = (prof.displayName || user.email || '?').slice(0, 1).toUpperCase();
    }

    // Статистика
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

    els.stats.innerHTML = `
      <div class="profile-stat-row"><span>Треков в избранном</span><span>${favCount}</span></div>
      <div class="profile-stat-row"><span>Альбомов</span><span>${albumCount}</span></div>
      <div class="profile-stat-row"><span>Артистов</span><span>${artistCount}</span></div>
      <div class="profile-stat-row"><span>Плейлистов</span><span>${plCount}</span></div>
      <div class="profile-stat-row"><span>Всего прослушано</span><span>${totalPlays}</span></div>
    `;

    els.favArtist.textContent = topArtist ? `${topArtist[0]} · ${topArtist[1]} прослуш.` : '—';
    els.favGenre.textContent  = topGenre  ? `${topGenre[0]} · ${topGenre[1]} прослуш.` : '—';
  }

  return { init };
})();