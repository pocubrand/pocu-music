/* Pocu Music — Pocu Pulse */
window.PocuPulse = (() => {
  let queue = [];
  let active = false;
  let mood = null;

  const QUEUE_SIZE = 20;
  const REFILL_BELOW = 5;

  function buildProfile() {
    const favorites = window.PocuStore.favorites.all();
    const recent    = window.PocuStore.recent.all();
    const all       = window.PocuLibrary.all();
    const map       = new Map(all.map(t => [t.id, t]));
    const prefs     = window.PocuStore.preferences?.get?.() || { genres: [], artists: [] };
    const favArtists = new Set(window.PocuStore.favoriteArtists?.all?.() || []);

    const genreW = new Map(), artistW = new Map();
    const add = (m, k, w) => { if (!k) return; m.set(k, (m.get(k) || 0) + w); };

    for (const id of favorites) {
      const t = map.get(id); if (!t) continue;
      add(genreW, t.genre, 3);
      add(artistW, t.artist, 3);
    }
    const now = Date.now();
    for (const r of recent) {
      const t = map.get(r.id); if (!t) continue;
      const w = Math.max(0.2, 1 - (now - r.t) / 86400000 / 30);
      add(genreW, t.genre, w);
      add(artistW, t.artist, w);
    }

    // preferences — доп. вес
    for (const g of prefs.genres) add(genreW, g, 5);
    for (const a of prefs.artists) add(artistW, a, 5);
    for (const a of favArtists) add(artistW, a, 2);

    return { genreW, artistW, favoriteIds: new Set(favorites) };
  }

  function scoreTrack(track, profile, recentIds) {
    let score = 0.5;
    if (track.genre)  score += (profile.genreW.get(track.genre) || 0) * 1.2;
    if (track.artist) score += (profile.artistW.get(track.artist) || 0) * 0.9;
    if (profile.favoriteIds.has(track.id)) score += 2.0;
    if (recentIds.has(track.id)) score -= 6;

    const stats = window.PocuStore.skipStats.get(track.id);
    if (stats.skips > 0 && stats.plays > 0) {
      const skipRate = stats.skips / (stats.plays + stats.skips);
      if (skipRate > 0.5) score -= 2 * skipRate;
    }
    if (mood) {
      if (track.genre === mood) score += 4;
      else score -= 2;
    }
    score += Math.random() * 0.7;
    return score;
  }

  function generateQueue(count = QUEUE_SIZE) {
    const dislikedSet = new Set(window.PocuStore.disliked.all());
    const all = window.PocuLibrary.all().filter(t => t.preview && !dislikedSet.has(t.id));
    if (!all.length) return [];

    const profile = buildProfile();
    const recentIds = new Set(window.PocuStore.recent.all().slice(0, 5).map(r => r.id));

    const scored = all.map(t => ({ track: t, score: scoreTrack(t, profile, recentIds) }));
    scored.sort((a, b) => b.score - a.score);
    const pool = scored.slice(0, Math.min(scored.length, count * 2));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      if (Math.abs(pool[i].score - pool[j].score) < pool[i].score * 0.15) {
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
    return pool.slice(0, count).map(x => x.track);
  }

  function start(force = false) {
    if (active && !force) return;
    if (window.PocuPlayer.getState().playing && active) return;
    queue = generateQueue(QUEUE_SIZE);
    if (!queue.length) { console.warn('[pulse] нет треков'); return; }
    active = true;
    window.PocuPlayer.playQueue(queue, 0);
    notify();
  }
  function stop() { active = false; queue = []; notify(); }

  function ensureQueue() {
    if (!active) return;
    const st = window.PocuPlayer.getState();
    if (!st.track) return;
    if (!queue.some(t => t.id === st.track.id)) return;
    const remaining = st.queue.length - st.queueIndex - 1;
    if (remaining > REFILL_BELOW) return;
    const existing = new Set(queue.map(t => t.id));
    const fresh = generateQueue(QUEUE_SIZE).filter(t => !existing.has(t.id));
    if (!fresh.length) return;
    queue.push(...fresh);
    window.PocuPlayer.appendQueue(fresh);
  }

  function refresh() {
    let newQueue = generateQueue(QUEUE_SIZE);
    const currentId = window.PocuPlayer.current?.id;
    if (currentId && newQueue[0]?.id === currentId && newQueue.length > 1) {
      [newQueue[0], newQueue[1]] = [newQueue[1], newQueue[0]];
    }
    if (!newQueue.length) { showToast('Pocu Pulse · Нет треков'); return; }
    queue = newQueue; active = true;
    window.PocuPlayer.playQueue(queue, 0);
    notify();
    showToast('Pocu Pulse · Обновлено');
  }

  function showToast(text) {
    const el = document.createElement('div');
    el.className = 'pulse-toast';
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 1800);
  }

  function notify() {
    document.dispatchEvent(new CustomEvent('pulse:update', {
      detail: { active, mood, queue: queue.slice() }
    }));
  }

  function init() {
    window.PocuPlayer.subscribe(state => {
      ensureQueue();
      if (active && state.track) {
        if (!queue.some(t => t.id === state.track.id)) {
          active = false; queue = []; notify();
        }
      }
    });
  }

  return {
    init, start, stop, refresh,
    preview(count = 10) { return generateQueue(count); },
    get active() { return active; },
    get mood()   { return mood; },
    get queue()  { return queue.slice(); }
  };
})();