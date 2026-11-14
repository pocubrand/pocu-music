/* Pocu Music — аудио-плеер + 30-сек + эквалайзер */
window.PocuPlayer = (() => {
  const audio = new Audio();
  audio.preload = 'metadata';

  let current       = null;
  let queue         = [];
  let queueIndex    = -1;
  let shuffle       = false;
  let repeat        = 'off';
  let shuffledOrder = null;
  let volume        = 1;
  let muted         = false;
  const listeners   = new Set();

  /* 30-сек tracking */
  const played30 = new Set();
  let prevTrackId = null;
  let prevMaxTime = 0;

  /* Web Audio EQ */
  const EQ_FREQS = [60, 230, 910, 3600, 14000];
  let audioCtx = null;
  let sourceNode = null;
  let eqFilters = [];

  function ensureAudioContext() {
    if (audioCtx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { console.warn('[eq] no AudioContext'); return; }
      audioCtx = new AC();
      sourceNode = audioCtx.createMediaElementSource(audio);
      eqFilters = EQ_FREQS.map(freq => {
        const f = audioCtx.createBiquadFilter();
        f.type = 'peaking';
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = 0;
        return f;
      });
      sourceNode.connect(eqFilters[0]);
      for (let i = 0; i < eqFilters.length - 1; i++) eqFilters[i].connect(eqFilters[i + 1]);
      eqFilters[eqFilters.length - 1].connect(audioCtx.destination);
      console.log('[eq] audio context ready');
    } catch (e) { console.warn('[eq] init failed:', e); }
  }

  function setEQ(bands) {
    ensureAudioContext();
    if (!eqFilters.length || !Array.isArray(bands)) return;
    for (let i = 0; i < eqFilters.length; i++) {
      const v = Number(bands[i]);
      eqFilters[i].gain.value = isFinite(v) ? Math.max(-12, Math.min(12, v)) : 0;
    }
  }

  function getEQ() {
    if (!eqFilters.length) return [0, 0, 0, 0, 0];
    return eqFilters.map(f => f.gain.value);
  }

  function resumeAudioCtx() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  }

  /* 30-сек зачёт */
  function markNewTrack(track) {
    if (prevTrackId && prevMaxTime > 0 && prevMaxTime < 20) {
      window.PocuStore?.skipStats?.recordSkip(prevTrackId);
    }
    prevTrackId = track ? track.id : null;
    prevMaxTime = 0;
    if (track) played30.delete(track.id);
  }

  function getState() {
    return {
      track: current,
      playing: current ? !audio.paused : false,
      time: current ? audio.currentTime : 0,
      duration: current ? (audio.duration || current.duration || 0) : 0,
      queue: queue.slice(),
      queueIndex,
      shuffle, repeat, volume, muted
    };
  }

  function notify() {
    const s = getState();
    listeners.forEach(fn => { try { fn(s); } catch (e) { console.warn(e); } });
  }

  function buildShuffledOrder(fromIndex) {
    const indices = [...Array(queue.length).keys()].filter(i => i !== fromIndex);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    indices.unshift(fromIndex);
    return indices;
  }

  function playQueue(tracks, startIndex = 0) {
    if (!tracks || !tracks.length) return;
    const startTrack = tracks[startIndex];
    if (!startTrack) return;
    if (current && current.id === startTrack.id) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    queue = tracks.slice();
    queueIndex = Math.max(0, Math.min(startIndex, queue.length - 1));
    shuffledOrder = shuffle ? buildShuffledOrder(queueIndex) : null;
    playCurrentInQueue();
  }

  async function playCurrentInQueue() {
    if (queueIndex < 0 || queueIndex >= queue.length) return;
    const track = queue[queueIndex];
    if (!track || !track.preview) return;
    current = track;
    markNewTrack(track);
    audio.src = track.preview;
    updateMediaSession(track);
    if (window.PocuStore) window.PocuStore.recent.add(track.id);
    resumeAudioCtx();
    try { await audio.play(); }
    catch (e) { if (e.name === 'AbortError') return; console.warn('[player] play failed', e); }
  }

  async function play(track) {
    if (!track || !track.preview) return;
    if (current && current.id === track.id) {
      if (audio.paused) { resumeAudioCtx(); try { await audio.play(); } catch (e) { if (e.name !== 'AbortError') console.warn(e); } }
      else audio.pause();
      return;
    }
    queue = [track]; queueIndex = 0; shuffledOrder = null; current = track;
    markNewTrack(track);
    audio.src = track.preview;
    updateMediaSession(track);
    if (window.PocuStore) window.PocuStore.recent.add(track.id);
    resumeAudioCtx();
    try { await audio.play(); }
    catch (e) { if (e.name === 'AbortError') return; console.warn('[player] play failed', e); }
  }

  /* «Играть следующим»: вставляет трек сразу после текущего.
     - Если ничего не играет — просто запускает.
     - Если трек уже играет — no-op.
     - Удаляет существующие копии трека из очереди, корректно сдвигая
       queueIndex и shuffledOrder.
     - LIFO: повторный вызов ставит новый трек ещё «ближе». */
  function insertNext(track) {
    if (!track || !track.preview) return;

    // Ничего не играет — просто запускаем
    if (!current) { play(track); return; }

    // Текущий трек — ничего не делаем
    if (current.id === track.id) return;

    // Если shuffle включён, но порядок ещё не построен — строим от текущего
    if (shuffle && !shuffledOrder) {
      shuffledOrder = buildShuffledOrder(queueIndex);
    }

    // Убираем все существующие копии этого трека из очереди
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].id === track.id && i !== queueIndex) {
        queue.splice(i, 1);
        if (i < queueIndex) queueIndex--;
        if (shuffledOrder) {
          const soIdx = shuffledOrder.indexOf(i);
          if (soIdx >= 0) shuffledOrder.splice(soIdx, 1);
          for (let k = 0; k < shuffledOrder.length; k++) {
            if (shuffledOrder[k] > i) shuffledOrder[k]--;
          }
        }
      }
    }

    // Вставляем сразу после текущего
    const insertPos = queueIndex + 1;
    queue.splice(insertPos, 0, track);

    // Правим shuffle-порядок: сдвигаем все индексы >= insertPos и ставим новый сразу после текущего
    if (shuffledOrder) {
      for (let i = 0; i < shuffledOrder.length; i++) {
        if (shuffledOrder[i] >= insertPos) shuffledOrder[i]++;
      }
      const curPos = shuffledOrder.indexOf(queueIndex);
      if (curPos >= 0) shuffledOrder.splice(curPos + 1, 0, insertPos);
      else shuffledOrder.push(insertPos);
    }

    notify();
  }

  function next(_guard = 0) {
    if (!queue.length) return;
    if (_guard > queue.length) return;
    if (repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    let nextIdx;
    if (shuffle && shuffledOrder) {
      const pos = shuffledOrder.indexOf(queueIndex);
      const npos = pos + 1;
      if (npos >= shuffledOrder.length) {
        if (repeat === 'all') nextIdx = shuffledOrder[0];
        else { audio.pause(); return; }
      } else nextIdx = shuffledOrder[npos];
    } else {
      if (queueIndex + 1 >= queue.length) {
        if (repeat === 'all') nextIdx = 0;
        else { audio.pause(); return; }
      } else nextIdx = queueIndex + 1;
    }
    queueIndex = nextIdx;
    if (window.PocuStore?.disliked?.has(queue[queueIndex]?.id)) return next(_guard + 1);
    playCurrentInQueue();
  }

  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (!queue.length) return;
    let prevIdx;
    if (shuffle && shuffledOrder) {
      const pos = shuffledOrder.indexOf(queueIndex);
      const ppos = pos - 1;
      if (ppos < 0) {
        if (repeat === 'all') prevIdx = shuffledOrder[shuffledOrder.length - 1];
        else { audio.currentTime = 0; return; }
      } else prevIdx = shuffledOrder[ppos];
    } else {
      if (queueIndex - 1 < 0) {
        if (repeat === 'all') prevIdx = queue.length - 1;
        else { audio.currentTime = 0; return; }
      } else prevIdx = queueIndex - 1;
    }
    queueIndex = prevIdx;
    playCurrentInQueue();
  }

  function togglePlay() {
    if (!current) return;
    resumeAudioCtx();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function seek(seconds) {
    if (!current || !isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
  }

  function setShuffle(v) { shuffle = !!v; shuffledOrder = shuffle ? buildShuffledOrder(queueIndex) : null; notify(); }
  function setRepeat(mode) { if (!['off','all','one'].includes(mode)) return; repeat = mode; notify(); }
  function toggleShuffle() { setShuffle(!shuffle); }
  function cycleRepeat() { const order=['off','all','one']; setRepeat(order[(order.indexOf(repeat)+1)%order.length]); }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    audio.volume = volume;
    if (volume > 0) { muted = false; audio.muted = false; }
    try { localStorage.setItem('pocu.volume', String(volume)); } catch {}
    notify();
  }
  function toggleMute() { muted = !muted; audio.muted = muted; notify(); }

  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title, artist: track.artist, album: track.album || '',
        artwork: track.artwork ? [{ src: track.artwork, sizes: '512x512', type: 'image/jpeg' }] : []
      });
    } catch (e) {}
  }
  function setPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = current ? (audio.paused ? 'paused' : 'playing') : 'none';
  }
  function updatePositionState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!current || !isFinite(audio.duration) || audio.duration === 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration, playbackRate: 1,
        position: Math.min(audio.currentTime, audio.duration)
      });
    } catch (e) {}
  }

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('seekto', e => { if (e.seekTime != null) seek(e.seekTime); });
    } catch (e) {}
  }

  ['play','pause','timeupdate','loadedmetadata','error','seeked'].forEach(ev =>
    audio.addEventListener(ev, () => {
      setPlaybackState();
      if (ev === 'timeupdate') updatePositionState();
      notify();
    }));

  audio.addEventListener('timeupdate', () => {
    if (!current) return;
    const t = audio.currentTime;
    if (t > prevMaxTime) prevMaxTime = t;
    if (t >= 30 && !played30.has(current.id)) {
      played30.add(current.id);
      window.PocuStore?.skipStats?.recordPlay(current.id);
    }
  });

  audio.addEventListener('ended', () => {
    if (repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); }
    else next();
  });

  return {
    appendQueue(tracks) {
      if (!tracks || !tracks.length) return;
      const startIdx = queue.length;
      queue.push(...tracks);
      if (shuffle && shuffledOrder) for (let i = 0; i < tracks.length; i++) shuffledOrder.push(startIdx + i);
      notify();
    },
    play, playQueue, insertNext, next, prev, togglePlay, seek,
    toggleShuffle, cycleRepeat, setShuffle, setRepeat,
    setVolume, toggleMute,
    setEQ, getEQ,
    EQ_FREQS,
    audio,
    get current() { return current; },
    getState,
    subscribe(fn) { listeners.add(fn); fn(getState()); return () => listeners.delete(fn); }
  };
})();