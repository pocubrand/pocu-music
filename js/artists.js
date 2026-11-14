/* Pocu Music — локальная библиотека артистов из audio/artists.json */
window.PocuArtists = (() => {
  let artists = [];
  let byId    = new Map();
  let byName  = new Map();
  let loaded  = false;
  let loading = null;

  // Разделители коллабораций: "&", ",", ";", "feat", "ft", "with", "vs", "x"
  const COLLAB_SPLIT = /\s*(?:&|,|;|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bvs\.?\b|\bx\b)\s*/i;

  async function load() {
    if (loaded)  return artists;
    if (loading) return loading;

    loading = (async () => {
      try {
        const res = await fetch('./audio/artists.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`artists.json: ${res.status}`);
        const raw = await res.json();

        const arr = Array.isArray(raw) ? raw : Object.values(raw);
        artists = arr.map(normalize).filter(a => a.id);

        byId = new Map(artists.map(a => [a.id, a]));
        byName = new Map();
        for (const a of artists) {
          byName.set(a.name.toLowerCase(), a);
          for (const al of a.aliases) {
            byName.set(String(al).toLowerCase(), a);
          }
        }

        loaded = true;
        return artists;
      } catch (e) {
        console.warn('[artists] load failed', e);
        artists = [];
        loaded = true;
        return artists;
      } finally {
        loading = null;
      }
    })();

    return loading;
  }

  function normalize(raw) {
    return {
      id:       String(raw.id || raw.name || '').trim(),
      name:     raw.name || raw.id || 'Без имени',
      bio:      raw.bio || '',
      photo:    raw.photo || '',
      links:    (raw.links && typeof raw.links === 'object') ? raw.links : {},
      featured: !!raw.featured,
      aliases:  Array.isArray(raw.aliases) ? raw.aliases.map(String) : []
    };
  }

  function all()      { return artists.slice(); }
  function featured() { return artists.filter(a => a.featured); }
  function get(id)    { return byId.get(String(id)) || null; }

  /* ---------- разбор строки артиста трека ---------- */
  function splitArtists(artistField) {
    if (!artistField) return [];
    return String(artistField)
      .split(COLLAB_SPLIT)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  /* ---------- относится ли трек к этому артисту ---------- */
  function trackMatchesArtist(track, artist) {
    if (!track || !artist) return false;

    // 1. artistId — самый надёжный способ
    if (track.artistId && String(track.artistId) === String(artist.id)) return true;

    const trackArtistLow = String(track.artist || '').toLowerCase().trim();
    if (!trackArtistLow) return false;

    const artistNames = new Set([
      artist.name.toLowerCase(),
      ...artist.aliases.map(a => String(a).toLowerCase())
    ]);

    // 2. Точное совпадение
    if (artistNames.has(trackArtistLow)) return true;

    // 3. Разбор коллабов
    for (const p of splitArtists(trackArtistLow)) {
      if (artistNames.has(p)) return true;
    }

    return false;
  }

  /* ---------- "основной" артист трека (для совместимости) ---------- */
  function matchTrack(track) {
    if (!track) return null;
    if (track.artistId && byId.has(String(track.artistId))) {
      return byId.get(String(track.artistId));
    }
    const low = String(track.artist || '').toLowerCase().trim();
    if (!low) return null;
    if (byName.has(low)) return byName.get(low);
    for (const p of splitArtists(low)) {
      if (byName.has(p)) return byName.get(p);
    }
    return null;
  }

  /* ---------- все треки артиста (включая коллабы) ---------- */
  function tracksFor(artistId) {
    const artist = get(artistId);
    if (!artist) return [];
    return window.PocuLibrary.all().filter(t => trackMatchesArtist(t, artist));
  }

  return {
    load, all, featured, get,
    matchTrack,          // "первый" артист (совместимость)
    trackMatchesArtist,  // строгая проверка
    tracksFor,
    splitArtists
  };
})();