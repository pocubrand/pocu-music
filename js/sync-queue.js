/* Pocu Music — офлайн-очередь синка
   Когда нет сети (или сервер ответил ошибкой), операции кладутся в очередь.
   При возврате online / логине / таймере — проигрываются. */
window.PocuSyncQueue = (() => {
  const KEY = 'pocu.sync.queue.v1';
  const MAX_ATTEMPTS = 3;
  const MAX_QUEUE = 500;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function write(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX_QUEUE)));
    } catch (e) { console.warn('[sync-queue] write failed:', e); }
  }

  function enqueue(type, payload) {
    const q = read();
    q.push({ type, payload, ts: Date.now(), attempts: 0 });
    write(q);
    console.log('[sync-queue] +', type, '| total:', q.length);
  }

  async function runOp(op) {
    const s = window.PocuSupabase;
    if (!s) throw new Error('no supabase');
    switch (op.type) {
      case 'playlist.create':         return s.syncPlaylistCreate(op.payload);
      case 'playlist.update':         return s.syncPlaylistUpdate(op.payload.plId, op.payload.fields);
      case 'playlist.delete':         return s.syncPlaylistDelete(op.payload);
      case 'playlist.track.add':      return s.syncPlaylistTrackAdd(op.payload.plId, op.payload.trackId);
      case 'playlist.track.remove':   return s.syncPlaylistTrackRemove(op.payload.plId, op.payload.trackId);
      case 'favorite.playlist.add':   return s.syncFavoritePlaylist(op.payload, true);
      case 'favorite.playlist.remove':return s.syncFavoritePlaylist(op.payload, false);
      case 'favorite.add':            return s.syncFavorite(op.payload, true);
      case 'favorite.remove':         return s.syncFavorite(op.payload, false);
      case 'favorite.album.add':      return s.syncFavoriteAlbum(op.payload.artist, op.payload.album, true);
      case 'favorite.album.remove':   return s.syncFavoriteAlbum(op.payload.artist, op.payload.album, false);
      case 'favorite.artist.add':     return s.syncFavoriteArtist(op.payload, true);
      case 'favorite.artist.remove':  return s.syncFavoriteArtist(op.payload, false);
      case 'dislike.add':             return s.syncDislike(op.payload, true);
      case 'dislike.remove':          return s.syncDislike(op.payload, false);
      case 'profile.update':          return s.syncProfile(op.payload);
      default:
        console.warn('[sync-queue] unknown type:', op.type);
        return;
    }
  }

  async function flush() {
    if (!navigator.onLine) return;
    if (!window.PocuSupabase?.getUser?.()) return;

    const q = read();
    if (!q.length) return;

    console.log('[sync-queue] flushing', q.length, 'op(s)');
    const keep = [];
    for (const op of q) {
      try {
        await runOp(op);
        console.log('[sync-queue] ✓', op.type);
      } catch (e) {
        op.attempts = (op.attempts || 0) + 1;
        if (op.attempts >= MAX_ATTEMPTS) {
          console.warn('[sync-queue] ✗ drop after', op.attempts, 'attempts:', op.type, e);
        } else {
          console.warn('[sync-queue] ✗ retry', op.type, e);
          keep.push(op);
        }
      }
    }
    write(keep);
    console.log('[sync-queue] done, remaining:', keep.length);
  }

  function init() {
    window.addEventListener('online', () => {
      console.log('[sync-queue] online → flush in 1s');
      setTimeout(flush, 1000);
    });
    document.addEventListener('pocu:auth', e => {
      if (e.detail?.user) setTimeout(flush, 1500);
    });
    setInterval(() => { if (navigator.onLine) flush(); }, 60000);
  }

  return { init, flush, enqueue, count: () => read().length };
})();