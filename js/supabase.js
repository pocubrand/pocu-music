/* Pocu Music — клиент Supabase */
window.PocuSupabase = (() => {
  const SUPABASE_URL = 'https://klxfjojwhnxoushohzao.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_kajeQkgBYiUlm9B-dqy-JQ_bbSYP9sv';

  let client = null;
  let currentUser = null;
  let handledInitial = false;

  function init() {
    if (typeof window.supabase === 'undefined') {
      console.warn('[supabase] Библиотека не загружена');
      return;
    }
    if (client) return client;

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    client.auth.onAuthStateChange(async (event, session) => {
      const wasLoggedIn = !!currentUser;
      currentUser = session ? session.user : null;

      document.dispatchEvent(new CustomEvent('pocu:auth', { detail: { user: currentUser } }));

      if (event === 'PASSWORD_RECOVERY') {
        document.dispatchEvent(new CustomEvent('pocu:password-recovery'));
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentUser) {
        if (handledInitial) return;
        handledInitial = true;
        await handleLoginSync();
      }

      if (event === 'SIGNED_OUT') {
        handledInitial = false;
        if (wasLoggedIn) window.PocuStore.resetToGuest();
      }
    });

    return client;
  }

  async function signIn(email, password) {
    if (!client) init();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }
  async function signUp(email, password) {
    if (!client) init();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }
  async function signOut() {
    if (!client) return;
    try { await client.auth.signOut(); } catch (e) { console.warn('[auth] signOut failed:', e); }
    currentUser = null;
    handledInitial = false;
    window.PocuStore.resetToGuest();
    document.dispatchEvent(new CustomEvent('pocu:auth', { detail: { user: null } }));
  }
  async function resetPassword(email) {
    if (!client) init();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;
  }
  async function updatePassword(newPassword) {
    if (!client) init();
    const { data, error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  }
  function getUser() { return currentUser; }

  /* ============ ЛОГИН-СИНК ============ */
  async function handleLoginSync() {
    console.log('[sync] start');
    try {
      const cloudData = await fetchCloudData();
      const hasCloudData =
        cloudData.favorites.length > 0 ||
        cloudData.playlists.length > 0 ||
        cloudData.favoriteAlbums.length > 0 ||
        cloudData.favoriteArtists.length > 0 ||
        Object.keys(cloudData.skipStats).length > 0 ||
        !!(cloudData.profile && (cloudData.profile.displayName || cloudData.profile.avatarUrl));

      if (hasCloudData) {
        console.log('[sync] cloud has data — applying');
        window.PocuStore.applyCloudState(cloudData);
      } else {
        console.log('[sync] cloud empty — pushing local');
        await pushLocalToCloud();
      }
    } catch (e) {
      console.error('[sync] failed:', e);
    }
  }

  async function fetchCloudData() {
    const out = {
      favorites: [], playlists: [], recent: [], disliked: [],
      favoriteAlbums: [], favoriteArtists: [], skipStats: {}, profile: null
    };

    try { const { data } = await client.from('favorites').select('track_id'); if (data) out.favorites = data.map(f => f.track_id); }
    catch (e) { console.warn('[fetch] favorites:', e.message); }

    try {
      const { data } = await client.from('playlists').select('id, name, created_at, playlist_tracks(track_id, position)');
      if (data) out.playlists = data.map(p => ({
        id: p.id, name: p.name, createdAt: new Date(p.created_at).getTime(),
        trackIds: p.playlist_tracks ? p.playlist_tracks.sort((a,b)=>a.position-b.position).map(t => t.track_id) : []
      }));
    } catch (e) { console.warn('[fetch] playlists:', e.message); }

    try {
      const { data } = await client.from('recent').select('track_id, played_at')
        .order('played_at', { ascending: false }).limit(30);
      if (data) out.recent = data.map(r => ({ id: r.track_id, t: new Date(r.played_at).getTime() }));
    } catch (e) { console.warn('[fetch] recent:', e.message); }

    try { const { data } = await client.from('dislikes').select('track_id'); if (data) out.disliked = data.map(d => d.track_id); }
    catch (e) { console.warn('[fetch] dislikes:', e.message); }

    try {
      const { data } = await client.from('skip_stats').select('track_id, plays, skips, last_play');
      if (data) for (const row of data) out.skipStats[row.track_id] = {
        plays: row.plays || 0, skips: row.skips || 0,
        lastPlay: row.last_play ? new Date(row.last_play).getTime() : 0
      };
    } catch (e) { console.warn('[fetch] skip_stats:', e.message); }

    try { const { data } = await client.from('favorite_albums').select('artist, album'); if (data) out.favoriteAlbums = data.map(x => `${x.artist}::${x.album}`); }
    catch (e) { console.warn('[fetch] favorite_albums:', e.message); }

    try { const { data } = await client.from('favorite_artists').select('artist_id'); if (data) out.favoriteArtists = data.map(x => x.artist_id); }
    catch (e) { console.warn('[fetch] favorite_artists:', e.message); }

    try {
      const { data, error } = await client.from('profiles')
        .select('display_name, avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (error) console.warn('[fetch] profile error:', error.message);
      if (data) out.profile = { displayName: data.display_name || '', avatarUrl: data.avatar_url || '' };
      else console.log('[fetch] profile row not found');
    } catch (e) { console.warn('[fetch] profile:', e.message); }

    return out;
  }

  async function pushLocalToCloud() {
    const local = window.PocuStore.exportState();
    if (local.favorites.length) {
      const rows = local.favorites.map(id => ({ user_id: currentUser.id, track_id: id }));
      await client.from('favorites').upsert(rows, { onConflict: 'user_id,track_id' });
    }
    if (local.disliked.length) {
      await client.from('dislikes').upsert(local.disliked.map(id => ({ user_id: currentUser.id, track_id: id })));
    }
    if (local.favoriteAlbums.length) {
      const rows = local.favoriteAlbums.map(k => {
        const i = k.indexOf('::');
        return { user_id: currentUser.id, artist: k.slice(0, i), album: k.slice(i + 2) };
      });
      await client.from('favorite_albums').upsert(rows, { onConflict: 'user_id,artist,album' });
    }
    if (local.favoriteArtists.length) {
      await client.from('favorite_artists').upsert(
        local.favoriteArtists.map(id => ({ user_id: currentUser.id, artist_id: id })),
        { onConflict: 'user_id,artist_id' }
      );
    }
    for (const pl of local.playlists) {
      const { data: newPl } = await client.from('playlists').insert({ user_id: currentUser.id, name: pl.name }).select().single();
      if (newPl && pl.trackIds.length) {
        const tracks = pl.trackIds.map((tid, idx) => ({ playlist_id: newPl.id, track_id: tid, position: idx }));
        await client.from('playlist_tracks').insert(tracks);
      }
    }
    if (local.profile.displayName || local.profile.avatarUrl) {
      await syncProfile(local.profile);
    }
  }

  /* ============ ОПЕРАЦИИ ============ */
  async function syncFavorite(trackId, isFav) {
    if (!currentUser || !client) return;
    try {
      if (isFav) await client.from('favorites').upsert({ user_id: currentUser.id, track_id: trackId }, { onConflict: 'user_id,track_id' });
      else await client.from('favorites').delete().match({ user_id: currentUser.id, track_id: trackId });
    } catch (e) { console.warn('[sync] favorite:', e.message); }
  }

  async function syncFavoriteAlbum(artist, album, isFav) {
    if (!currentUser || !client) return;
    try {
      if (isFav) await client.from('favorite_albums').upsert({ user_id: currentUser.id, artist, album }, { onConflict: 'user_id,artist,album' });
      else await client.from('favorite_albums').delete().match({ user_id: currentUser.id, artist, album });
    } catch (e) { console.warn('[sync] favorite_album:', e.message); }
  }

  async function syncFavoriteArtist(artistId, isFav) {
    if (!currentUser || !client) return;
    try {
      if (isFav) await client.from('favorite_artists').upsert({ user_id: currentUser.id, artist_id: artistId }, { onConflict: 'user_id,artist_id' });
      else await client.from('favorite_artists').delete().match({ user_id: currentUser.id, artist_id: artistId });
    } catch (e) { console.warn('[sync] favorite_artist:', e.message); }
  }

  /* syncProfile: select → update/insert (надёжнее upsert при RLS) */
  async function syncProfile(fields) {
    if (!currentUser || !client) return;
    try {
      const patch = {};
      if ('displayName' in fields) patch.display_name = fields.displayName || null;
      if ('avatarUrl'   in fields) patch.avatar_url   = fields.avatarUrl   || null;
      if (!Object.keys(patch).length) return;

      // Проверяем наличие
      const { data: existing, error: selErr } = await client.from('profiles')
        .select('id').eq('id', currentUser.id).maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        const { error } = await client.from('profiles')
          .update(patch).eq('id', currentUser.id);
        if (error) throw error;
        console.log('[profile] updated');
      } else {
        const { error } = await client.from('profiles')
          .insert({ id: currentUser.id, ...patch });
        if (error) throw error;
        console.log('[profile] inserted');
      }
    } catch (e) { console.warn('[sync] profile:', e.message); }
  }

  /* Публичный fetchProfile — для принудительной синхронизации при открытии настроек */
  async function fetchProfile() {
    if (!currentUser || !client) return null;
    try {
      const { data, error } = await client.from('profiles')
        .select('display_name, avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { displayName: data.display_name || '', avatarUrl: data.avatar_url || '' };
    } catch (e) { console.warn('[sync] fetchProfile:', e.message); return null; }
  }

  async function syncTrackPlay(trackId) {
    if (!currentUser || !client) return;
    try {
      await client.from('track_plays').insert({ user_id: currentUser.id, track_id: trackId });
    } catch (e) { console.warn('[sync] track_play:', e.message); }
  }

  async function fetchTopTracks(days = 7, limit = 50) {
    if (!client) init();
    try {
      const { data, error } = await client.rpc('get_top_tracks', { days, lim: limit });
      if (error) throw error;
      return (data || []).map(r => ({ trackId: r.track_id, plays: Number(r.plays) }));
    } catch (e) { console.warn('[charts] fetchTopTracks:', e.message); return []; }
  }

  async function fetchNewTracks(days = 30, limit = 50) {
    if (!client) init();
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await client.from('track_plays').select('track_id, played_at')
        .gte('played_at', since).order('played_at', { ascending: true });
      const seen = new Set();
      const ordered = [];
      for (const row of data || []) {
        if (seen.has(row.track_id)) continue;
        seen.add(row.track_id);
        ordered.push({ trackId: row.track_id, firstPlayed: new Date(row.played_at).getTime() });
      }
      ordered.sort((a, b) => b.firstPlayed - a.firstPlayed);
      return ordered.slice(0, limit);
    } catch (e) { console.warn('[charts] fetchNewTracks:', e.message); return []; }
  }

  async function syncRecent(trackId) {
    if (!currentUser || !client) return;
    try {
      await client.from('recent').delete().match({ user_id: currentUser.id, track_id: trackId });
      await client.from('recent').insert({ user_id: currentUser.id, track_id: trackId, played_at: new Date().toISOString() });
    } catch (e) { console.warn('[sync] recent:', e.message); }
  }

  async function syncSkipStats(trackId, type) {
    if (!currentUser || !client) return;
    try {
      const { data } = await client.from('skip_stats').select('plays, skips')
        .match({ user_id: currentUser.id, track_id: trackId }).maybeSingle();
      if (data) {
        const patch = type === 'play'
          ? { plays: (data.plays || 0) + 1, last_play: new Date().toISOString() }
          : { skips: (data.skips || 0) + 1 };
        await client.from('skip_stats').update(patch).match({ user_id: currentUser.id, track_id: trackId });
      } else {
        await client.from('skip_stats').insert({
          user_id: currentUser.id, track_id: trackId,
          plays: type === 'play' ? 1 : 0,
          skips: type === 'skip' ? 1 : 0,
          last_play: type === 'play' ? new Date().toISOString() : null
        });
      }
    } catch (e) { console.warn('[sync] skip_stats:', e.message); }
  }

  async function syncDislike(trackId, isDisliked) {
    if (!currentUser || !client) return;
    try {
      if (isDisliked) await client.from('dislikes').upsert({ user_id: currentUser.id, track_id: trackId });
      else await client.from('dislikes').delete().match({ user_id: currentUser.id, track_id: trackId });
    } catch (e) { console.warn('[sync] dislike:', e.message); }
  }

  async function syncPlaylistCreate(pl) {
    if (!currentUser || !client) return;
    try { await client.from('playlists').insert({ id: pl.id, user_id: currentUser.id, name: pl.name }); }
    catch (e) { console.warn('[sync] pl create:', e.message); }
  }
  async function syncPlaylistRename(plId, name) {
    if (!currentUser || !client) return;
    try { await client.from('playlists').update({ name }).match({ id: plId, user_id: currentUser.id }); }
    catch (e) { console.warn('[sync] pl rename:', e.message); }
  }
  async function syncPlaylistDelete(plId) {
    if (!currentUser || !client) return;
    try { await client.from('playlists').delete().match({ id: plId, user_id: currentUser.id }); }
    catch (e) { console.warn('[sync] pl delete:', e.message); }
  }
  async function syncPlaylistTrackAdd(plId, trackId) {
    if (!currentUser || !client) return;
    try {
      const { data } = await client.from('playlist_tracks').select('position')
        .eq('playlist_id', plId).order('position', { ascending: false }).limit(1);
      const nextPos = data && data.length ? data[0].position + 1 : 0;
      await client.from('playlist_tracks').insert({ playlist_id: plId, track_id: trackId, position: nextPos });
    } catch (e) { console.warn('[sync] pl track add:', e.message); }
  }
  async function syncPlaylistTrackRemove(plId, trackId) {
    if (!currentUser || !client) return;
    try { await client.from('playlist_tracks').delete().match({ playlist_id: plId, track_id: trackId }); }
    catch (e) { console.warn('[sync] pl track remove:', e.message); }
  }

  return {
    init, signIn, signUp, signOut, resetPassword, updatePassword, getUser,
    syncFavorite, syncFavoriteAlbum, syncFavoriteArtist, syncProfile, fetchProfile,
    syncTrackPlay, fetchTopTracks, fetchNewTracks,
    syncPlaylistCreate, syncPlaylistRename, syncPlaylistDelete,
    syncPlaylistTrackAdd, syncPlaylistTrackRemove,
    syncRecent, syncSkipStats, syncDislike
  };
})();