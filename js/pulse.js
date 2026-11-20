/* Pocu Music — Pocu Pulse 2.0
   Слоты времени / anti-repetition артистов / жанр длинных прослушиваний
   + Insights («Pulse думает о вкусе») с SVG-иконками */
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

  /* ---------- SVG-иконки ---------- */
  const ICONS = {
    learning:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>',
    genre:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    picky:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>',
    explorer:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/></svg>',
    fan:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.2s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.2 2.7c0 4.9-7.2 9.3-7.2 9.3z"/></svg>',
    completionist:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
    melomane:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/></svg>',
    background:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    artist:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
    night:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    default:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>'
  };

  function getIconSvg(type) { return ICONS[type] || ICONS.default; }

  /* ---------- профиль ---------- */
  function buildProfile() {
    const favorites  = window.PocuStore.favorites.all();
    const recent     = window.PocuStore.recent.all();
    const all        = window.PocuLibrary.all();
    const map        = new Map(all.map(t => [t.id, t]));
    const prefs      = window.PocuStore.preferences?.get?.() || { genres: [], artists: [] };
    const favArtists = new Set(window.PocuStore.favoriteArtists?.all?.() || []);
    const skipStats  = window.PocuStore.skipStats;

    const splitA = (s) => window.PocuArtists?.splitArtists?.(s) || [s];

    const genreW = new Map(), artistW = new Map();
    const add = (m, k, w) => { if (!k) return; m.set(k, (m.get(k) || 0) + w); };

    for (const id of favorites) {
      const t = map.get(id); if (!t) continue;
      add(genreW, t.genre, 3);
      for (const a of splitA(t.artist)) add(artistW, a, 3);
    }
    const now = Date.now();
    for (const r of recent) {
      const t = map.get(r.id); if (!t) continue;
      const w = Math.max(0.2, 1 - (now - r.t) / 86400000 / 30);
      add(genreW, t.genre, w);
      for (const a of splitA(t.artist)) add(artistW, a, w);
    }
    for (const g of prefs.genres)  add(genreW, g, 5);
    // prefs.artists могут храниться как id — попробуем подтянуть имя через PocuArtists
    for (const a of prefs.artists) {
      add(artistW, a, 5);
      const obj = window.PocuArtists?.get?.(a);
      if (obj?.name && obj.name !== a) add(artistW, obj.name, 5);
    }
    for (const a of favArtists)    add(artistW, a, 2);

    // === НОРМАЛИЗАЦИЯ: log-сжатие сырых весов ===
    // Формула: norm = log(1 + raw) * scale
    // Смысл: любимые жанры/артисты всё равно выше остальных,
    // но разрыв между топ-жанром (raw=50) и минорным (raw=3) падает
    // с 16x (50/3) до ~2.8x (log(51)*5 / log(4)*5).
    // Итог: лайк (+2..3.6) и явные prefs (+5) реально влияют.
    const GENRE_LOG_SCALE  = 5;
    const ARTIST_LOG_SCALE = 4;
    const squash = (rawMap, scale) => {
      const out = new Map();
      for (const [k, w] of rawMap) out.set(k, Math.log(1 + w) * scale);
      return out;
    };
    const genreWNorm  = squash(genreW,  GENRE_LOG_SCALE);
    const artistWNorm = squash(artistW, ARTIST_LOG_SCALE);

    // Явные предпочтения — отдельные Set для быстрой проверки в scoreTrack.
    // prefs.artists могут храниться как id — добавим и имя, если найдём.
    const preferredGenres = new Set(prefs.genres.map(String));
    const preferredArtists = new Set();
    for (const a of prefs.artists) {
      preferredArtists.add(String(a));
      const obj = window.PocuArtists?.get?.(a);
      if (obj?.name) preferredArtists.add(obj.name);
    }

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

    return {
      genreW: genreWNorm,
      artistW: artistWNorm,
      favoriteIds: new Set(favorites),
      genreCompletion,
      preferredGenres,
      preferredArtists
    };
  }

  function getRecentArtistCounts() {
    const counts = new Map();
    const st = window.PocuPlayer?.getState?.();
    if (!st || st.queueIndex < 0) return counts;
    const start = Math.max(0, st.queueIndex - ARTIST_HISTORY_WINDOW + 1);
    const history = st.queue.slice(start, st.queueIndex + 1);
    for (const t of history) {
      if (!t?.artist) continue;
      for (const a of (window.PocuArtists?.splitArtists?.(t.artist) || [t.artist])) {
        counts.set(a, (counts.get(a) || 0) + 1);
      }
    }
    return counts;
  }

  function scoreTrack(track, profile, recentIds, artistCounts, mods) {
    let score = 0.5;
    if (track.genre) {
      score += (profile.genreW.get(track.genre) || 0) * 1.2;
      const cr = profile.genreCompletion.get(track.genre);
      if (cr != null) score += (cr - 0.5) * 4 * mods.completion;

      // Явный сигнал: пользователь выбрал этот жанр в настройках.
      // +5 не сжимается log-нормализацией, поэтому явный выбор
      // всегда «слышен» даже в минорном жанре.
      if (profile.preferredGenres.has(track.genre)) score += 5;
    }
    if (track.artist) {
      const artists = window.PocuArtists?.splitArtists?.(track.artist) || [track.artist];
      let hasPreferredArtist = false;
      for (const a of artists) {
        score += (profile.artistW.get(a) || 0) * 0.9 * mods.artistBoost;
        const n = artistCounts.get(a) || 0;
        if (n > 0) score -= n * 2.5;

        if (profile.preferredArtists.has(a)) hasPreferredArtist = true;
      }
      // Бонус за артиста — один раз на трек, не за каждого в коллабе
      if (hasPreferredArtist) score += 4;
      // На случай, если prefs.artists хранят artistId — проверяем и его
      if (track.artistId && profile.preferredArtists.has(track.artistId)) score += 4;
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

    // Discovery: новое — приоритет. Только что открытое (1-2 прослушивания)
    // получает половину бонуса — шанс «закрепиться», а не исчезнуть после
    // первого прослушивания.
    if (plays === 0)         score += mods.discovery;
    else if (plays <= 2)     score += mods.discovery * 0.5;
    else                     score -= Math.min(plays / 10, 1) * mods.discovery * 0.3;

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
    // Гарантируем попадание всех лайкнутых треков в пул,
    // иначе они проигрывают топ-жанру и вылетают из топ-60
    const poolIds = new Set(pool.map(p => p.track.id));
    for (const s of scored) {
      if (profile.favoriteIds.has(s.track.id) && !poolIds.has(s.track.id)) {
        pool.push(s);
        poolIds.add(s.track.id);
      }
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      if (Math.abs(pool[i].score - pool[j].score) < Math.max(0.5, pool[i].score * 0.15)) {
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }

    const picked = [];
    const lastArtists = [];
    // Гарантируем 2 лайкнутых трека в начале (если они не в recent-окне)
    const guaranteedLiked = [];
    const recentSet = new Set(window.PocuStore.recent.all().slice(0, 8).map(r => r.id));
    for (const s of scored) {
      if (guaranteedLiked.length >= 2) break;
      if (profile.favoriteIds.has(s.track.id) && !recentSet.has(s.track.id)) {
        guaranteedLiked.push(s.track);
      }
    }
    for (const t of guaranteedLiked) {
      picked.push(t);
      for (const a of (window.PocuArtists?.splitArtists?.(t.artist) || [t.artist])) {
        lastArtists.push(a);
      }
    }
    const st = window.PocuPlayer?.getState?.();
    if (st && st.queueIndex >= 0) {
      const start = Math.max(0, st.queueIndex - 1);
      const recentTwo = st.queue.slice(start, st.queueIndex + 1);
      for (const t of recentTwo) if (t?.artist) lastArtists.push(t.artist);
    }

    let poolIdx = 0;
    while (picked.length < count && poolIdx < pool.length) {
      const cand = pool[poolIdx].track;
      if (picked.some(p => p.id === cand.id)) { poolIdx++; continue; }
      const candArtists = window.PocuArtists?.splitArtists?.(cand.artist) || [cand.artist];
      const lastTwo = lastArtists.slice(-2);
      if (candArtists.some(a => lastTwo.includes(a))) { poolIdx++; continue; }
      picked.push(cand);
      lastArtists.push(...candArtists);
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

  function startFromTrack(track) {
    if (!track || !track.preview) return;
    let base = generateQueue(QUEUE_SIZE);
    base = base.filter(t => t.id !== track.id);
    base.unshift(track);
    queue = base.slice(0, QUEUE_SIZE);
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
     Pulse Insights
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
        type: 'learning',
        icon: getIconSvg('learning'),
        text: 'Pulse изучает ваш вкус',
        detail: 'Прослушайте ещё немного треков — Pulse начнёт понимать вас'
      };
    }

    if (stats.topGenres.length) {
      const [genre, g] = stats.topGenres[0];
      const share = stats.totalPlays > 0 ? g.plays / stats.totalPlays : 0;
      if (share >= 0.4) {
        return {
          type: 'genre',
          icon: getIconSvg('genre'),
          text: `Вы слушаете много ${genitive(genre)}`,
          detail: `${genre} занимает ${Math.round(share * 100)}% ваших прослушиваний`
        };
      }
    }

    if (stats.skipRate > 0.5) {
      return {
        type: 'picky',
        icon: getIconSvg('picky'),
        text: 'Вы очень придирчивы',
        detail: `${Math.round(stats.skipRate * 100)}% треков вы пропускаете`
      };
    }

    if (stats.discoveryRate > 0.4) {
      return {
        type: 'explorer',
        icon: getIconSvg('explorer'),
        text: 'Вы — исследователь',
        detail: `Вы открыли ${Math.round(stats.discoveryRate * 100)}% библиотеки`
      };
    }

    if (stats.repeatRate > 0.6) {
      return {
        type: 'fan',
        icon: getIconSvg('fan'),
        text: 'Вы — верный фанат',
        detail: `${Math.round(stats.repeatRate * 100)}% прослушиваний — повторные`
      };
    }

    if (stats.completeRate > 0.7) {
      return {
        type: 'completionist',
        icon: getIconSvg('completionist'),
        text: 'Вы любите дослушивать до конца',
        detail: `${Math.round(stats.completeRate * 100)}% треков дослушаны полностью`
      };
    }

    if (stats.genresWithPlays >= 6) {
      return {
        type: 'melomane',
        icon: getIconSvg('melomane'),
        text: 'Вы — меломан',
        detail: `Вы слушаете музыку в ${stats.genresWithPlays} жанрах`
      };
    }

    if (stats.skipRate > 0.4 && stats.completeRate < 0.3) {
      return {
        type: 'background',
        icon: getIconSvg('background'),
        text: 'Вы слушаете музыку фоном',
        detail: 'Много пропусков — Pulse учтёт это'
      };
    }

    if (stats.topArtists.length && stats.topArtists[0][1].plays >= 5) {
      const [artist, a] = stats.topArtists[0];
      return {
        type: 'artist',
        icon: getIconSvg('artist'),
        text: `Ваш любимый артист — ${artist}`,
        detail: `${a.plays} прослушиваний`
      };
    }

    if (stats.topSlot === 'night') {
      return {
        type: 'night',
        icon: getIconSvg('night'),
        text: 'Вы — ночной слушатель',
        detail: 'Больше всего слушаете после 23:00'
      };
    }

    return {
      type: 'default',
      icon: getIconSvg('default'),
      text: 'Pulse уже знает ваш вкус',
      detail: 'Откройте, чтобы увидеть статистику'
    };
  }

  function getAllInsights() {
    const stats = getStats();
    const out = [];

    if (stats.topGenres.length) {
      const [genre, g] = stats.topGenres[0];
      const share = stats.totalPlays > 0 ? g.plays / stats.totalPlays : 0;
      const extra = stats.topGenres.slice(1, 3)
        .map(([gg, ss]) => {
          const sh = stats.totalPlays > 0 ? ss.plays / stats.totalPlays : 0;
          return `${gg} ${Math.round(sh * 100)}%`;
        }).join(' · ');
      out.push({
        type: 'genre', icon: getIconSvg('genre'),
        title: `Топ-жанр: ${genre}`,
        value: `${Math.round(share * 100)}%`,
        detail: extra || `${g.plays} прослушиваний`
      });
    }

    if (stats.topArtists.length) {
      const [artist, a] = stats.topArtists[0];
      out.push({
        type: 'artist', icon: getIconSvg('artist'),
        title: `Любимый артист: ${artist}`,
        value: `${a.plays}`,
        detail: a.plays === 1 ? 'прослушивание' : (a.plays >= 2 && a.plays <= 4 ? 'прослушивания' : 'прослушиваний')
      });
    }

    if (stats.topSlot) {
      const names  = { morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь' };
      const ranges = { morning: '5:00–11:59', day: '12:00–17:59', evening: '18:00–22:59', night: '23:00–4:59' };
      out.push({
        type: 'slot', icon: getIconSvg('night'),
        title: `Активнее всего — ${names[stats.topSlot]}`,
        value: ranges[stats.topSlot],
        detail: `${stats.slots[stats.topSlot]} прослушиваний`
      });
    }

    out.push({
      type: 'completion', icon: getIconSvg('completionist'),
      title: 'Дослушиваете до конца',
      value: `${Math.round(stats.completeRate * 100)}%`,
      detail: `${stats.totalComplete} из ${stats.totalPlays}`
    });

    out.push({
      type: 'skip', icon: getIconSvg('picky'),
      title: 'Пропускаете',
      value: `${Math.round(stats.skipRate * 100)}%`,
      detail: `${stats.totalSkips} скипов`
    });

    out.push({
      type: 'discovery', icon: getIconSvg('explorer'),
      title: 'Исследование библиотеки',
      value: `${Math.round(stats.discoveryRate * 100)}%`,
      detail: `${stats.tracksPlayed} из ${stats.librarySize} треков`
    });

    return out;
  }

  return {
    init, start, startFromTrack, stop, refresh,
    preview(count = 10) { return generateQueue(count); },
    getInsight, getAllInsights, getStats, getIconSvg,
    get active() { return active; },
    get mood()   { return mood; },
    get slot()   { return getSlot(); },
    get queue()  { return queue.slice(); }
  };
})();