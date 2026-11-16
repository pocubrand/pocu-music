/* Pocu Music — Pocu Pulse 2.0
   Слоты времени / anti-repetition артистов / жанр длинных прослушиваний
   + Insights («Pulse думает о вкусе») */
window.PocuPulse = (() => {
  let queue = [];
  let active = false;
  let mood = null;

  const QUEUE_SIZE = 20;
  const REFILL_BELOW = 5;
  const ARTIST_HISTORY_WINDOW = 5;

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

  /* ---------- профиль ---------- */
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
      genreCompletion.set(g, (s.complete + 0.5) / (s.plays + s.skips + 1));
    }

    return { genreW, artistW, favoriteIds: new Set(favorites), genreCompletion };
  }

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

  function scoreTrack(track, profile, recentIds, artistCounts, mods) {
    let score = 0.5;
    if (track.genre) {
      score += (profile.genreW.get(track.genre) || 0) * 1.2;
      const cr = profile.genreCompletion.get(track.genre);
      if (cr != null) score += (cr - 0.5) * 4 * mods.completion;
    }
    if (track.artist) {
      score += (profile.artistW.get(track.artist) || 0) * 0.9 * mods.artistBoost;
      const n = artistCounts.get(track.artist) || 0;
      if (n > 0) score -= n * 2.5;
    }
    if (profile.favoriteIds.has(track.id)) score += 2.0 * mods.favBoost;
    if (recentIds.has(track.id)) score -= mods.recencyPenalty;

    const stats = window.PocuStore.skipStats.get(track.id);
    const plays = Number(stats.plays || 0);
    const skips = Number(stats.skips || 0);

    if (skips > 0 && (plays + skips) > 0) {
      const skipRate = skips / (plays + skips);
      if (skipRate > 0.5) score -= 2 * skipRate;
    }
    if (plays === 0) score += mods.discovery;
    else score -= Math.min(plays / 10, 1) * mods.discovery * 0.3;

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

    const pool = scored.slice(0, Math.min(scored.length, count * 3));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      if (Math.abs(pool[i].score - pool[j].score) < Math.max(0.5, pool[i].score * 0.15)) {
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }

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
      if (cand.artist && lastTwo.includes(cand.artist)) { poolIdx++; continue; }
      picked.push(cand);
      if (cand.artist) lastArtists.push(cand.artist);
      poolIdx++;
    }
    if (picked.length < count) {
      for (const item of pool) {
        if (picked.length >= count) break;
        if (picked.some(p => p.id === item.track.id)) continue;
        picked.push(item.track);
      }
    }
    return picked.slice(0, count);
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
      detail: { active, mood, queue: queue.slice(), slot: getSlot() }
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

  /* ============================================================
     Pulse Insights — «Что Pulse думает о вашем вкусе»
     ============================================================ */

  function getStats() {
    const all    = window.PocuLibrary.all();
    const raw    = window.PocuStore.skipStats.all();
    const recent = window.PocuStore.recent.all();

    let totalPlays = 0, totalComplete = 0, totalSkips = 0, totalRepeatPlays = 0;
    const genreStats  = new Map();
    const artistStats = new Map();

    for (const t of all) {
      const s        = raw[t.id] || {};
      const plays    = Number(s.plays    || 0);
      const complete = Number(s.complete || 0);
      const skips    = Number(s.skips    || 0);
      totalPlays    += plays;
      totalComplete += complete;
      totalSkips    += skips;
      if (plays > 1) totalRepeatPlays += (plays - 1);

      if (t.genre) {
        const g = genreStats.get(t.genre) || { plays: 0, complete: 0, skips: 0 };
        g.plays += plays; g.complete += complete; g.skips += skips;
        genreStats.set(t.genre, g);
      }
      if (t.artist) {
        const a = artistStats.get(t.artist) || { plays: 0, complete: 0, skips: 0 };
        a.plays += plays; a.complete += complete; a.skips += skips;
        artistStats.set(t.artist, a);
      }
    }

    const topGenres = [...genreStats.entries()]
      .filter(([, g]) => g.plays > 0)
      .sort((a, b) => b[1].plays - a[1].plays);
    const topArtists = [...artistStats.entries()]
      .filter(([, a]) => a.plays > 0)
      .sort((a, b) => b[1].plays - a[1].plays);

    const totalActions = totalPlays + totalSkips;
    const skipRate     = totalActions > 0 ? totalSkips / totalActions : 0;
    const completeRate = totalPlays   > 0 ? totalComplete / totalPlays     : 0;
    const repeatRate   = totalPlays   > 0 ? totalRepeatPlays / totalPlays  : 0;
    const tracksPlayed = all.filter(t => (raw[t.id]?.plays || 0) > 0).length;
    const discoveryRate = all.length > 0 ? tracksPlayed / all.length : 0;

    const slots = { morning: 0, day: 0, evening: 0, night: 0 };
    for (const r of recent) {
      const h = new Date(r.t).getHours();
      if (h >= 5 && h < 12) slots.morning++;
      else if (h >= 12 && h < 18) slots.day++;
      else if (h >= 18 && h < 23) slots.evening++;
      else slots.night++;
    }
    const slotEntries = Object.entries(slots).sort((a, b) => b[1] - a[1]);
    const topSlotName = slotEntries[0] && slotEntries[0][1] > 0 ? slotEntries[0][0] : null;

    return {
      totalPlays, totalComplete, totalSkips,
      skipRate, completeRate, repeatRate, discoveryRate,
      tracksPlayed, librarySize: all.length,
      topGenres, topArtists,
      slots, topSlot: topSlotName,
      genresWithPlays: topGenres.length
    };
  }

  /* Русский родительный падеж (для жанров) */
  function genitive(genre) {
    if (!genre) return genre;
    if (!/[а-яё]/i.test(genre)) return genre;
    const g = String(genre).trim();
    const last = g.slice(-1).toLowerCase();
    if (last === 'а' || last === 'я') return g.slice(0, -1) + 'и';
    if ('еёиоуыэю'.includes(last)) return g;
    return g + 'а';
  }

  function getInsight() {
    const stats = getStats();

    if (stats.totalPlays < 10) {
      return {
        type: 'learning', icon: '🎧',
        text: 'Pulse изучает ваш вкус',
        detail: 'Прослушайте ещё немного треков — Pulse начнёт понимать вас'
      };
    }

    // 1. Доминирующий жанр (> 40%)
    if (stats.topGenres.length) {
      const [genre, g] = stats.topGenres[0];
      const share = stats.totalPlays > 0 ? g.plays / stats.totalPlays : 0;
      if (share >= 0.4) {
        return {
          type: 'genre', icon: '🎯',
          text: `Вы слушаете много ${genitive(genre)}`,
          detail: `${genre} занимает ${Math.round(share * 100)}% ваших прослушиваний`
        };
      }
    }

    // 2. Придирчивы
    if (stats.skipRate > 0.5) {
      return {
        type: 'picky', icon: '🧐',
        text: 'Вы очень придирчивы',
        detail: `${Math.round(stats.skipRate * 100)}% треков вы пропускаете`
      };
    }

    // 3. Исследователь
    if (stats.discoveryRate > 0.4) {
      return {
        type: 'explorer', icon: '🔭',
        text: 'Вы — исследователь',
        detail: `Вы открыли ${Math.round(stats.discoveryRate * 100)}% библиотеки`
      };
    }

    // 4. Верный фанат
    if (stats.repeatRate > 0.6) {
      return {
        type: 'fan', icon: '💜',
        text: 'Вы — верный фанат',
        detail: `${Math.round(stats.repeatRate * 100)}% прослушиваний — повторные`
      };
    }

    // 5. Дослушиваете до конца
    if (stats.completeRate > 0.7) {
      return {
        type: 'completionist', icon: '✅',
        text: 'Вы любите дослушивать до конца',
        detail: `${Math.round(stats.completeRate * 100)}% треков дослушаны полностью`
      };
    }

    // 6. Меломан
    if (stats.genresWithPlays >= 6) {
      return {
        type: 'melomane', icon: '🎨',
        text: 'Вы — меломан',
        detail: `Вы слушаете музыку в ${stats.genresWithPlays} жанрах`
      };
    }

    // 7. Слушаете фоном
    if (stats.skipRate > 0.4 && stats.completeRate < 0.3) {
      return {
        type: 'background', icon: '🌙',
        text: 'Вы слушаете музыку фоном',
        detail: 'Много пропусков — Pulse учтёт это'
      };
    }

    // 8. Любимый артист
    if (stats.topArtists.length && stats.topArtists[0][1].plays >= 5) {
      const [artist, a] = stats.topArtists[0];
      return {
        type: 'artist', icon: '🎤',
        text: `Ваш любимый артист — ${artist}`,
        detail: `${a.plays} прослушиваний`
      };
    }

    // 9. Ночной слушатель
    if (stats.topSlot === 'night') {
      return {
        type: 'night', icon: '🌃',
        text: 'Вы — ночной слушатель',
        detail: 'Больше всего слушаете после 23:00'
      };
    }

    // 10. Fallback
    return {
      type: 'default', icon: '✨',
      text: 'Pulse уже знает ваш вкус',
      detail: 'Откройте, чтобы увидеть статистику'
    };
  }

  function getAllInsights() {
    const stats = getStats();
    const out = [];

    // Жанр (топ-3)
    if (stats.topGenres.length) {
      const [genre, g] = stats.topGenres[0];
      const share = stats.totalPlays > 0 ? g.plays / stats.totalPlays : 0;
      const extra = stats.topGenres.slice(1, 3)
        .map(([gg, ss]) => {
          const sh = stats.totalPlays > 0 ? ss.plays / stats.totalPlays : 0;
          return `${gg} ${Math.round(sh * 100)}%`;
        }).join(' · ');
      out.push({
        type: 'genre', icon: '🎯',
        title: `Топ-жанр: ${genre}`,
        value: `${Math.round(share * 100)}%`,
        detail: extra || `${g.plays} прослушиваний`
      });
    }

    // Артист
    if (stats.topArtists.length) {
      const [artist, a] = stats.topArtists[0];
      out.push({
        type: 'artist', icon: '🎤',
        title: `Любимый артист: ${artist}`,
        value: `${a.plays}`,
        detail: a.plays === 1 ? 'прослушивание' : (a.plays >= 2 && a.plays <= 4 ? 'прослушивания' : 'прослушиваний')
      });
    }

    // Слот
    if (stats.topSlot) {
      const names  = { morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь' };
      const ranges = { morning: '5:00–11:59', day: '12:00–17:59', evening: '18:00–22:59', night: '23:00–4:59' };
      out.push({
        type: 'slot', icon: '⏰',
        title: `Активнее всего — ${names[stats.topSlot]}`,
        value: ranges[stats.topSlot],
        detail: `${stats.slots[stats.topSlot]} прослушиваний`
      });
    }

    // Complete
    out.push({
      type: 'completion', icon: '✅',
      title: 'Дослушиваете до конца',
      value: `${Math.round(stats.completeRate * 100)}%`,
      detail: `${stats.totalComplete} из ${stats.totalPlays}`
    });

    // Skip
    out.push({
      type: 'skip', icon: '⏭',
      title: 'Пропускаете',
      value: `${Math.round(stats.skipRate * 100)}%`,
      detail: `${stats.totalSkips} скипов`
    });

    // Discovery
    out.push({
      type: 'discovery', icon: '🔭',
      title: 'Исследование библиотеки',
      value: `${Math.round(stats.discoveryRate * 100)}%`,
      detail: `${stats.tracksPlayed} из ${stats.librarySize} треков`
    });

    return out;
  }

  return {
    init, start, stop, refresh,
    preview(count = 10) { return generateQueue(count); },
    getInsight, getAllInsights, getStats,
    get active() { return active; },
    get mood()   { return mood; },
    get slot()   { return getSlot(); },
    get queue()  { return queue.slice(); }
  };
})();