/* Pocu Music — локальная библиотека из audio/library.json */
window.PocuLibrary = (() => {
  let tracks  = [];
  let loaded  = false;
  let loading = null;

  async function load() {
    if (loaded)  return tracks;
    if (loading) return loading;

    loading = (async () => {
      try {
        const res = await fetch('./audio/library.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`library.json: ${res.status}`);
        const raw = await res.json();

        tracks = raw
          .map(normalize)
          .filter(t => t.preview);
        loaded = true;
        return tracks;
      } catch (e) {
        console.warn('[library] load failed', e);
        tracks = [];
        loaded = true;
        return tracks;
      } finally {
        loading = null;
      }
    })();

    return loading;
  }

  function normalize(raw) {
    return {
      id:          String(raw.id ?? raw.preview ?? ''),
      title:       raw.title  || 'Без названия',
      artist:      raw.artist || 'Неизвестный исполнитель',
      album:       raw.album  || '',
      trackNumber: Number(raw.trackNumber) || 0,
      artwork:     raw.artwork || '',
      preview:     raw.preview || '',
      duration:    Number(raw.duration) || 0,
      genre:       raw.genre || '',
      artistId:    raw.artistId || ''
    };
  }

  function all()      { return tracks.slice(); }
  function get(id)    { return tracks.find(t => t.id === id) || null; }
  function byIds(ids) {
    const set = new Set(ids);
    return tracks.filter(t => set.has(t.id));
  }

  /* Треки альбома в правильном порядке */
  function tracksForAlbum(artist, album) {
    if (!album) return [];
    return tracks
      .filter(t => (t.artist || '') === artist && (t.album || '') === album)
      .sort((a, b) => {
        const na = a.trackNumber || 999;
        const nb = b.trackNumber || 999;
        return na - nb;
      });
  }

  /* Список всех альбомов: [{ artist, album, cover, trackCount }] */
  function allAlbums() {
    const map = new Map();
    for (const t of tracks) {
      if (!t.album) continue;
      const key = `${t.artist}::${t.album}`;
      if (!map.has(key)) {
        map.set(key, { artist: t.artist, album: t.album, cover: '', trackCount: 0 });
      }
      const item = map.get(key);
      item.trackCount++;
      if (!item.cover && t.artwork) item.cover = t.artwork;
    }
    return [...map.values()];
  }

  function search(q) {
    const s = (q || '').trim().toLowerCase();
    if (!s) return [];
    return tracks.filter(t =>
      t.title.toLowerCase().includes(s) ||
      t.artist.toLowerCase().includes(s) ||
      t.album.toLowerCase().includes(s)
    );
  }

  return { load, all, get, byIds, tracksForAlbum, allAlbums, search };
})();