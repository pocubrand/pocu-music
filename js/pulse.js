/* Pocu Music — Pocu Pulse 2.0
   Слоты времени / anti-repetition артистов / жанр длинных прослушиваний */
window.PocuPulse = (() => {
  let queue = [];
  let active = false;
  let mood = null;

  const QUEUE_SIZE = 20;
  const REFILL_BELOW = 5;
  const ARTIST_HISTORY_WINDOW = 5;

  /* Коэффициенты по слотам времени суток.
     - favBoost        — буст любимых треков
     - artistBoost     — множитель к весу артиста
     - recencyPenalty  — штраф за недавно прослушанный трек
     - discovery       — буст трекам без прослушиваний
     - completion      — влияние жанр-завершённости (0..~2)
     - longBoost       — бонус длинным трекам (только night) */
  const SLOTS = {
    morning: { favBoost: 1.5, artistBoost: 1.3, recencyPenalty: 6, discovery: 0.2, completion: 1.5, longBoost: 0 },
    day:     { favBoost: 0.8, artistBoost: 0.9, recencyPenalty: 5, discovery: 0.8, completion: 1.0, longBoost: 0 },
    evening: { favBoost: 1.8, artistBoost: 1.5, recencyPenalty: 6, discovery: 0.1, completion: 1.8, longBoost: 0 },
    night:   { favBoost: 1.2, artistBoost: 1.2, recencyPenalty: 8, discovery: 0.5, completion: 2.0, longBoost: 1.0 }
  };

  function getSlot(d = new Date()) {
    const h = d.getHours();
    if (h >= 5  && h < 12) return 'morning';
    if (h >= 12 && h < 18) return 'day';
    if (h >= 18 && h < 23) return 'evening';
    return 'night';
  }

  function getMods() { return SLOTS[getSlot()] || SLOTS.day; }

  /* ---------- профиль пользователя ---------- */
  function buildProfile() {
    const favorites  = window.PocuStore.favorites.all();
    const recent     = window.PocuStore.recent.all();
    const all        = window.PocuLibrary.all();
    const map        = new Map(all.map(t => [t.id, t]));
    const prefs      = window.PocuStore.preferences?.get?.() || { genres: [], artists: [] };
    const favArtists = new Set(window.PocuStore.favoriteArtists?.all?.() || []);
    const skipStats  = window.PocuStore.skipStats;

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
    for (const g of prefs.genres)  add(genreW, g, 5);
    for (const a of prefs.artists) add(artistW, a, 5);
    for (const a of favArtists)    add(artistW, a, 2);

    /* Жанр-завершённость: plays/complete/skips по жанрам */
    const genreStat = new Map();
    for (const t of all) {
      if (!t.genre) continue;
      const s = skipStats.get(t.id);
      const g = genreStat.get(t.genre) || { plays: 0, complete: 0, skips: 0 };
      g.plays    += Number(s.plays    || 0);
      g.complete += Number(s.complete || 0);
      g.skips    += Number(s.skips    || 0);
      genreStat.set(t.genre, g);
    }
    const genreCompletion = new Map();
    for (const [g, s] of genreStat) {
      // Laplace-сглаживание: жанр без данных → нейтральный 0.5
      genreCompletion.set(g, (s.complete + 0.5) / (s.plays + s.skips + 1));
    }

    return { genreW, artistW, favoriteIds: new Set(favorites), genreCompletion };
  }

  /* ---------- anti-repetition: сколько раз артист уже сыграл ---------- */
  function getRecentArtistCounts() {
    const counts = new Map();
    const st = window.PocuPlayer?.getState?.();
    if (!st || st.queueIndex < 0) return counts;
    const start = Math.max(0, st.queueIndex - ARTIST_HISTORY_WINDOW + 1);
    const history = st.queue.slice(start, st.queueIndex + 1);
    for (const t of history) {
      if (t?.artist) counts.set(t.artist, (counts.get(t.artist) || 0) + 1);
    }
    return counts;
  }

  /* ---------- scoring ---------- */
  function scoreTrack(track, profile, recentIds, artistCounts, mods) {
    let score = 0.5;

    /* Жанр: аффинити + завершённость */
    if (track.genre) {
      score += (profile.genreW.get(track.genre) || 0) * 1.2;

      const cr = profile.genreCompletion.get(track.genre);
      if (cr != null) {
        score += (cr - 0.5) * 4 * mods.completion;
      }
    }

    /* Артист: аффинити − anti-repetition */
    if (track.artist) {
      score += (profile.artistW.get(track.artist) || 0) * 0.9 * mods.artistBoost;

      const n = artistCounts.get(track.artist) || 0;
      if (n > 0) score -= n * 2.5;
    }

    if (profile.favoriteIds.has(track.id)) score += 2.0 * mods.favBoost;

    if (recentIds.has(track.id)) score -= mods.recencyPenalty;

    /* Статы трека */
    const stats    = window.PocuStore.skipStats.get(track.id);
    const plays    = Number(stats.plays    || 0);
    const skips    = Number(stats.skips    || 0);

    if (skips > 0 && (plays + skips) > 0) {
      const skipRate = skips / (plays + skips);
      if (skipRate > 0.5) score -= 2 * skipRate;
    }

    /* Discovery: новизна (днём сильнее) */
    if (plays === 0) {
      score += mods.discovery;
    } else {
      score -= Math.min(plays / 10, 1) * mods.discovery * 0.3;
    }

    /* Ночью длинные треки предпочтительнее */
    if (mods.longBoost > 0 && track.duration) {
      if (track.duration >= 240) score += mods.longBoost;
      else if (track.duration < 90) score -= mods.longBoost * 0.5;
    }

    if (mood) {
      if (track.genre === mood) score += 4;
      else score -= 2;
    }

    score += Math.random() * 0.7;
    return score;
  }

  /* ---------- генерация очереди ---------- */
  function generateQueue(count = QUEUE_SIZE) {
    const dislikedSet = new Set(window.PocuStore.disliked.all());
    const all = window.PocuLibrary.all().filter(t => t.preview && !dislikedSet.has(t.id));
    if (!all.length) return [];

    const profile      = buildProfile();
    const mods         = getMods();
    const recentIds    = new Set(window.PocuStore.recent.all().slice(0, 5).map(r => r.id));
    const artistCounts = getRecentArtistCounts();

    const scored = all.map(t => ({ track: t, score: scoreTrack(t, profile, recentIds, artistCounts, mods) }));
    scored.sort((a, b) => b.score - a.score);

    /* Берём широкий пул — топ по score, затем чуть перемешиваем */
    const pool = scored.slice(0, Math.min(scored.length, count * 3));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      if (Math.abs(pool[i].score - pool[j].score) < Math.max(0.5, pool[i].score * 0.15)) {
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }

    /* Выбор без двух артистов подряд.
       Стартуем с «памяти» — последние артисты из реальной очереди плеера. */
    const picked = [];
    const lastArtists = [];
    const st = window.PocuPlayer?.getState?.();
    if (st && st.queueIndex >= 0) {
      const start = Math.max(0, st.queueIndex - 1);
      const recentTwo = st.queue.slice(start, st.queueIndex + 1);
      for (const t of recentTwo) if (t?.artist) lastArtists.push(t.artist);
    }

    let poolIdx = 0;
    while (picked.length < count && poolIdx < pool.length) {
      const cand = pool[poolIdx].track;
      const lastTwo = lastArtists.slice(-2);
      if (cand.artist && lastTwo.includes(cand.artist)) {
        poolIdx++;
        continue;
      }
      picked.push(cand);
      if (cand.artist) lastArtists.push(cand.artist);
      poolIdx++;
    }

    /* Добор, если пул кончился из-за anti-repetition */
    if (picked.length < count) {
      for (const item of pool) {
        if (picked.length >= count) break;
        if (picked.some(p => p.id === item.track.id)) continue;
        picked.push(item.track);
      }
    }

    return picked.slice(0, count);
  }

  /* ---------- управление ---------- */
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
    queue = newQueue;
    active = true;
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
      detail: { active, mood, queue: queue.slice(), slot: getSlot() }
    }));
  }

  function init() {
    window.PocuPlayer.subscribe(state => {
      ensureQueue();
      if (active && state.track) {
        if (!queue.some(t => t.id === state.track.id)) {
          active = false;
          queue = [];
          notify();
        }
      }
    });
  }

  return {
    init, start, stop, refresh,
    preview(count = 10) { return generateQueue(count); },
    get active() { return active; },
    get mood()   { return mood; },
    get slot()   { return getSlot(); },
    get queue()  { return queue.slice(); }
  };
})();