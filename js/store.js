/* Pocu Music — хранилище */
window.PocuStore = (() => {
  const KEY        = 'pocu.music.v1';
  const MAX_RECENT = 30;

  let state = {
    favorites: [], recent: [], playlists: [], disliked: [],
    settings: {}, skipStats: {},
    favoriteAlbums: [], favoriteArtists: [],
    profile: { displayName: '', avatarUrl: '' },
    preferences: { genres: [], artists: [] }
  };
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        state = {
          favorites: Array.isArray(p.favorites) ? p.favorites.map(String) : [],
          recent: Array.isArray(p.recent)
            ? p.recent.filter(r => r && r.id).map(r => ({ id: String(r.id), t: Number(r.t) || 0 }))
            : [],
          playlists: Array.isArray(p.playlists) ? p.playlists : [],
          disliked:  Array.isArray(p.disliked) ? p.disliked.map(String) : [],
          settings:  (p.settings && typeof p.settings === 'object') ? p.settings : {},
          skipStats: (p.skipStats && typeof p.skipStats === 'object') ? p.skipStats : {},
          favoriteAlbums:  Array.isArray(p.favoriteAlbums) ? p.favoriteAlbums.map(String) : [],
          favoriteArtists: Array.isArray(p.favoriteArtists) ? p.favoriteArtists.map(String) : [],
          profile: (p.profile && typeof p.profile === 'object')
            ? { displayName: String(p.profile.displayName || ''), avatarUrl: String(p.profile.avatarUrl || '') }
            : { displayName: '', avatarUrl: '' },
          preferences: (p.preferences && typeof p.preferences === 'object')
            ? {
                genres:  Array.isArray(p.preferences.genres)  ? p.preferences.genres.map(String)  : [],
                artists: Array.isArray(p.preferences.artists) ? p.preferences.artists.map(String) : []
              }
            : { genres: [], artists: [] }
        };
      }
    } catch (e) { console.warn('[store] load failed', e); }
    return state;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('[store] save failed', e); }
  }
  function notify() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.warn(e); } }); }
  function commit() { persist(); notify(); }
  function subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); }

  const favorites = {
    all() { return state.favorites.slice(); },
    has(id) { return state.favorites.includes(String(id)); },
    toggle(id) {
      id = String(id);
      const i = state.favorites.indexOf(id);
      if (i >= 0) state.favorites.splice(i, 1);
      else { state.favorites.unshift(id); const di = state.disliked.indexOf(id); if (di >= 0) state.disliked.splice(di, 1); }
      commit();
      return state.favorites.includes(id);
    },
    add(id) { id = String(id); if (!state.favorites.includes(id)) { state.favorites.unshift(id); commit(); } },
    remove(id) { id = String(id); const i = state.favorites.indexOf(id); if (i >= 0) { state.favorites.splice(i, 1); commit(); } }
  };

  const favoriteAlbums = {
    all() { return state.favoriteAlbums.slice(); },
    has(artist, album) { return state.favoriteAlbums.includes(`${artist}::${album}`); },
    toggle(artist, album) {
      const k = `${artist}::${album}`;
      const i = state.favoriteAlbums.indexOf(k);
      if (i >= 0) state.favoriteAlbums.splice(i, 1);
      else state.favoriteAlbums.unshift(k);
      commit();
      return state.favoriteAlbums.includes(k);
    },
    list() {
      return state.favoriteAlbums.map(k => {
        const i = k.indexOf('::');
        return { artist: k.slice(0, i), album: k.slice(i + 2) };
      });
    }
  };

  const favoriteArtists = {
    all() { return state.favoriteArtists.slice(); },
    has(id) { return state.favoriteArtists.includes(String(id)); },
    toggle(id) {
      id = String(id);
      const i = state.favoriteArtists.indexOf(id);
      if (i >= 0) state.favoriteArtists.splice(i, 1);
      else state.favoriteArtists.unshift(id);
      commit();
      return state.favoriteArtists.includes(id);
    }
  };

  const profile = {
    get() { return { ...state.profile }; },
    set(fields) { state.profile = { ...state.profile, ...fields }; commit(); }
  };

  const preferences = {
    get() { return JSON.parse(JSON.stringify(state.preferences)); },
    set(prefs) {
      state.preferences = {
        genres:  Array.isArray(prefs.genres)  ? [...new Set(prefs.genres.map(String))]  : [],
        artists: Array.isArray(prefs.artists) ? [...new Set(prefs.artists.map(String))] : []
      };
      // silent — изменения применятся к Pulse при следующем generateQueue, без перерисовки сейчас
      persist();
    }
  };

  const recent = {
    all() { return state.recent.slice(); },
    add(id) {
      id = String(id);
      state.recent = state.recent.filter(r => r.id !== id);
      state.recent.unshift({ id, t: Date.now() });
      if (state.recent.length > MAX_RECENT) state.recent.length = MAX_RECENT;
      commit();
      window.PocuSupabase?.syncRecent?.(id);
    },
    clear() { state.recent = []; commit(); }
  };

  function genId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'pl_' + Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9);
  }
  const playlists = {
    all() { return state.playlists.slice(); },
    get(id) { return state.playlists.find(p => p.id === id) || null; },
    create(name) {
      const pl = { id: genId(), name: (name || 'Новый плейлист').trim() || 'Новый плейлист', trackIds: [], createdAt: Date.now() };
      state.playlists.unshift(pl); commit(); return pl;
    },
    rename(id, name) {
      const pl = state.playlists.find(p => p.id === id);
      if (!pl) return;
      const n = (name || '').trim();
      if (n) { pl.name = n; commit(); }
    },
    delete(id) { state.playlists = state.playlists.filter(p => p.id !== id); commit(); },
    addTrack(plId, trackId) {
      const pl = state.playlists.find(p => p.id === plId);
      if (!pl) return;
      trackId = String(trackId);
      if (!pl.trackIds.includes(trackId)) { pl.trackIds.push(trackId); commit(); }
    },
    removeTrack(plId, trackId) {
      const pl = state.playlists.find(p => p.id === plId);
      if (!pl) return;
      pl.trackIds = pl.trackIds.filter(t => t !== String(trackId));
      commit();
    }
  };

  const settings = {
    get(key, fallback) { return key in state.settings ? state.settings[key] : fallback; },
    // silent: пишем в localStorage без notify — чтобы не триггерить перерисовку рекомендаций/подборок
    set(key, value) { state.settings[key] = value; persist(); }
  };

  const disliked = {
    all() { return state.disliked.slice(); },
    has(id) { return state.disliked.includes(String(id)); },
    toggle(id) {
      id = String(id);
      const i = state.disliked.indexOf(id);
      if (i >= 0) state.disliked.splice(i, 1);
      else { state.disliked.unshift(id); const fi = state.favorites.indexOf(id); if (fi >= 0) state.favorites.splice(fi, 1); }
      commit();
      return state.disliked.includes(id);
    },
    clear() { state.disliked = []; commit(); }
  };

  const skipStats = {
    all() { return state.skipStats; },
    get(id) { return state.skipStats[String(id)] || { plays: 0, skips: 0, lastPlay: 0 }; },
    recordPlay(id) {
      id = String(id);
      const now = Date.now();
      const s = state.skipStats[id] || { plays: 0, skips: 0, lastPlay: 0 };
      if (s.lastPlay && (now - s.lastPlay) < 20000) return;
      s.plays++; s.lastPlay = now;
      state.skipStats[id] = s;
      persist();
      window.PocuSupabase?.syncSkipStats?.(id, 'play');
      window.PocuSupabase?.syncTrackPlay?.(id);
    },
    recordSkip(id) {
      id = String(id);
      const s = state.skipStats[id] || { plays: 0, skips: 0, lastPlay: 0 };
      s.skips++;
      state.skipStats[id] = s;
      persist();
      window.PocuSupabase?.syncSkipStats?.(id, 'skip');
    }
  };

  return {
    load, persist: commit, subscribe,
    favorites, recent, playlists, disliked, settings, skipStats,
    favoriteAlbums, favoriteArtists, profile, preferences,

    exportState() { return JSON.parse(JSON.stringify(state)); },

    applyCloudState(cloudData) {
      state.favorites = cloudData.favorites || [];
      state.recent = cloudData.recent || [];
      state.playlists = cloudData.playlists || [];
      if (Array.isArray(cloudData.disliked)) state.disliked = cloudData.disliked;
      if (Array.isArray(cloudData.favoriteAlbums)) state.favoriteAlbums = cloudData.favoriteAlbums;
      if (Array.isArray(cloudData.favoriteArtists)) state.favoriteArtists = cloudData.favoriteArtists;

      // profile: НЕ затираем непустые локальные значения пустыми из облака
      if (cloudData.profile && typeof cloudData.profile === 'object') {
        const local  = state.profile;
        const remote = cloudData.profile;
        state.profile = {
          displayName: remote.displayName || local.displayName || '',
          avatarUrl:   remote.avatarUrl   || local.avatarUrl   || ''
        };
      }

      // preferences — только из облака (если там есть; иначе локальные)
      if (cloudData.preferences && typeof cloudData.preferences === 'object') {
        state.preferences = {
          genres:  Array.isArray(cloudData.preferences.genres)  ? cloudData.preferences.genres  : (state.preferences.genres || []),
          artists: Array.isArray(cloudData.preferences.artists) ? cloudData.preferences.artists : (state.preferences.artists || [])
        };
      }

      // skipStats — сервер истина
      if (cloudData.skipStats && typeof cloudData.skipStats === 'object') {
        state.skipStats = JSON.parse(JSON.stringify(cloudData.skipStats));
      }

      persist();
      notify();
    },

    resetToGuest() {
      state.favorites = [];
      state.recent = [];
      state.playlists = [];
      state.disliked = [];
      state.favoriteAlbums = [];
      state.favoriteArtists = [];
      state.profile = { displayName: '', avatarUrl: '' };
      // preferences оставляем локально — не привязаны к аккаунту
      persist();
      notify();
    }
  };
})();