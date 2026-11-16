/* Pocu Music — аудио-плеер + 30-сек + эквалайзер + crossfade + фиксы MediaSession */
window.PocuPlayer = (() => {
  const audioA = new Audio();
  const audioB = new Audio();
  [audioA, audioB].forEach(a => { a.preload = 'metadata'; a.volume = 1; });

  let current       = null;
  let queue         = [];
  let queueIndex    = -1;
  let shuffle       = false;
  let repeat        = 'off';
  let shuffledOrder = null;
  let volume        = 1;
  let muted         = false;
  const listeners   = new Set();

  let activeAudio = audioA;

  /* 30-сек tracking */
  const played30 = new Set();
  let prevTrackId = null;
  let prevMaxTime = 0;

  /* Web Audio EQ + crossfade */
  const EQ_FREQS = [60, 230, 910, 3600, 14000];
  let audioCtx = null;
  let sourceA = null, sourceB = null;
  let gainA = null, gainB = null;
  let masterGain = null;
  let eqFilters = [];
  let isCrossfading = false;
  let crossfadeToken = 0;

  function readSavedEQ() {
    try {
      const store = window.PocuStore?.settings;
      if (!store?.get) return null;
      const keys = ['eq', 'eqBands', 'equalizer', 'equalizerBands', 'eqState'];
      for (const k of keys) {
        const v = store.get(k, null);
        if (Array.isArray(v) && v.length === EQ_FREQS.length) return v;
      }
    } catch {}
    return null;
  }

  function applyEQValues(bands) {
    if (!eqFilters.length || !Array.isArray(bands)) return;
    for (let i = 0; i < eqFilters.length; i++) {
      const v = Number(bands[i]);
      eqFilters[i].gain.value = isFinite(v) ? Math.max(-12, Math.min(12, v)) : 0;
    }
  }

  function ensureAudioContext() {
    if (audioCtx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { console.warn('[audio] no AudioContext'); return; }
      audioCtx = new AC();

      sourceA = audioCtx.createMediaElementSource(audioA);
      sourceB = audioCtx.createMediaElementSource(audioB);
      gainA = audioCtx.createGain(); gainA.gain.value = 1;
      gainB = audioCtx.createGain(); gainB.gain.value = 1;
      masterGain = audioCtx.createGain();
      masterGain.gain.value = muted ? 0 : volume;

      eqFilters = EQ_FREQS.map(freq => {
        const f = audioCtx.createBiquadFilter();
        f.type = 'peaking';
        f.frequency.value = freq;
        f.Q.value = 1;
        f.gain.value = 0;
        return f;
      });

      sourceA.connect(gainA);
      sourceB.connect(gainB);
      gainA.connect(eqFilters[0]);
      gainB.connect(eqFilters[0]);
      for (let i = 0; i < eqFilters.length - 1; i++) eqFilters[i].connect(eqFilters[i + 1]);
      eqFilters[eqFilters.length - 1].connect(masterGain);
      masterGain.connect(audioCtx.destination);

      const saved = readSavedEQ();
      if (saved) {
        applyEQValues(saved);
        console.log('[audio] restored EQ:', saved);
      }

      audioCtx.addEventListener('statechange', () => {
        console.log('[audio] ctx state →', audioCtx.state);
      });

      audioA.volume = 1; audioB.volume = 1;
      audioA.muted = false; audioB.muted = false;

      console.log('[audio] context ready, state:', audioCtx.state);

      if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
        audioCtx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('[audio] init failed:', e);
      try { audioCtx?.close?.(); } catch {}
      audioCtx = null;
      sourceA = sourceB = null;
      gainA = gainB = masterGain = null;
      eqFilters = [];
    }
  }

  /* === Авторезюм AudioContext (фикс: пропадание звука при блокировке экрана / фоне) === */
  function ensureContextRunning() {
    if (!audioCtx) return;
    if (audioCtx.state === 'running' || audioCtx.state === 'closed') return;
    audioCtx.resume().catch(() => {});
  }

  function resumeAudioCtx() {
    ensureAudioContext();
    ensureContextRunning();
  }

  function setEQ(bands) {
    ensureAudioContext();
    if (!eqFilters.length) {
      console.warn('[audio] EQ: no filters — AudioContext not initialized');
      return;
    }
    if (!Array.isArray(bands)) return;
    applyEQValues(bands);
    if (audioCtx && (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted')) {
      audioCtx.resume().catch(() => {});
    }
    console.log(
      '[audio] EQ applied:', eqFilters.map(f => f.gain.value.toFixed(1)),
      '| ctx:', audioCtx?.state
    );
  }

  function getEQ() {
    if (!eqFilters.length) return [0, 0, 0, 0, 0];
    return eqFilters.map(f => f.gain.value);
  }

  function getCrossfadeTime() {
    try {
      const v = window.PocuStore?.settings?.get?.('crossfade', 0);
      const n = Number(v);
      return (n === 3 || n === 5 || n === 10) ? n : 0;
    } catch { return 0; }
  }

  function otherAudio()    { return activeAudio === audioA ? audioB : audioA; }
  function otherGainNode() { return activeAudio === audioA ? gainB : gainA; }
  function activeGainNode(){ return activeAudio === audioA ? gainA : gainB; }

  function cleanupElement(el) {
    try { el.pause(); el.removeAttribute('src'); el.load(); } catch {}
  }

  function resetGainNode(g) {
    if (!g || !audioCtx) return;
    try {
      g.gain.cancelScheduledValues(audioCtx.currentTime);
      g.gain.value = 1;
    } catch {}
  }

  function cancelCrossfade() {
    crossfadeToken++;
    if (!isCrossfading) return;
    isCrossfading = false;
    const oa = otherAudio();
    const og = otherGainNode();
    cleanupElement(oa);
    resetGainNode(og);
    resetGainNode(activeGainNode());
  }

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
      playing: current ? !activeAudio.paused : false,
      time: current ? activeAudio.currentTime : 0,
      duration: current ? (activeAudio.duration || current.duration || 0) : 0,
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

  function findNextIndex() {
    if (!queue.length) return -1;
    let idx = queueIndex;
    for (let guard = 0; guard < queue.length; guard++) {
      if (shuffle && shuffledOrder) {
        const pos = shuffledOrder.indexOf(idx);
        if (pos < 0) return -1;
        const npos = pos + 1;
        if (npos >= shuffledOrder.length) {
          if (repeat === 'all') idx = shuffledOrder[0];
          else return -1;
        } else idx = shuffledOrder[npos];
      } else {
        if (idx + 1 >= queue.length) {
          if (repeat === 'all') idx = 0;
          else return -1;
        } else idx = idx + 1;
      }
      const t = queue[idx];
      if (t && t.preview && !window.PocuStore?.disliked?.has(t.id)) return idx;
    }
    return -1;
  }

  function findPrevIndex() {
    if (!queue.length) return -1;
    let idx = queueIndex;
    for (let guard = 0; guard < queue.length; guard++) {
      if (shuffle && shuffledOrder) {
        const pos = shuffledOrder.indexOf(idx);
        if (pos < 0) return -1;
        const ppos = pos - 1;
        if (ppos < 0) {
          if (repeat === 'all') idx = shuffledOrder[shuffledOrder.length - 1];
          else return -1;
        } else idx = shuffledOrder[ppos];
      } else {
        if (idx - 1 < 0) {
          if (repeat === 'all') idx = queue.length - 1;
          else return -1;
        } else idx = idx - 1;
      }
      const t = queue[idx];
      if (t && t.preview) return idx;
    }
    return -1;
  }

  async function startCrossfade(fadeTime) {
    if (isCrossfading) return;
    const nextIdx = findNextIndex();
    if (nextIdx < 0) return;
    const nextTrack = queue[nextIdx];
    if (!nextTrack || !nextTrack.preview) return;

    ensureAudioContext();
    if (!gainA || !gainB || !audioCtx) return;

    isCrossfading = true;
    const myToken = ++crossfadeToken;

    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      try { await audioCtx.resume(); } catch {}
      if (myToken !== crossfadeToken) return;
    }

    const oldAudio = activeAudio;
    const oldGain  = (oldAudio === audioA) ? gainA : gainB;
    const newAudio = (oldAudio === audioA) ? audioB : audioA;
    const newGain  = (oldAudio === audioA) ? gainB : gainA;

    try {
      newAudio.src = nextTrack.preview;
      try { newAudio.currentTime = 0; } catch {}
      newGain.gain.cancelScheduledValues(audioCtx.currentTime);
      newGain.gain.setValueAtTime(0, audioCtx.currentTime);
      await newAudio.play();
    } catch (e) {
      if (myToken === crossfadeToken) isCrossfading = false;
      cleanupElement(newAudio);
      resetGainNode(newGain);
      return;
    }

    if (myToken !== crossfadeToken) {
      cleanupElement(newAudio);
      resetGainNode(newGain);
      return;
    }

    const now = audioCtx.currentTime;
    oldGain.gain.cancelScheduledValues(now);
    const oldVal = oldGain.gain.value;
    oldGain.gain.setValueAtTime(oldVal, now);
    oldGain.gain.linearRampToValueAtTime(0, now + fadeTime);

    newGain.gain.cancelScheduledValues(now);
    newGain.gain.setValueAtTime(0, now);
    newGain.gain.linearRampToValueAtTime(1, now + fadeTime);

    if (current) {
      try { window.PocuStore?.skipStats?.recordComplete?.(current.id); } catch {}
    }

    markNewTrack(nextTrack);
    current = nextTrack;
    queueIndex = nextIdx;
    if (window.PocuStore) window.PocuStore.recent.add(nextTrack.id);
    updateMediaSession(nextTrack);
    activeAudio = newAudio;

    setTimeout(() => {
      if (myToken !== crossfadeToken) return;
      cleanupElement(oldAudio);
      resetGainNode(oldGain);
      resetGainNode(newGain);
      isCrossfading = false;
      notify();
    }, fadeTime * 1000 + 150);

    notify();
  }

  function playQueue(tracks, startIndex = 0) {
    if (!tracks || !tracks.length) return;
    const startTrack = tracks[startIndex];
    if (!startTrack) return;
    if (current && current.id === startTrack.id) {
      if (activeAudio.paused) activeAudio.play().catch(() => {});
      else activeAudio.pause();
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

    cancelCrossfade();
    current = track;
    markNewTrack(track);

    cleanupElement(otherAudio());
    resetGainNode(otherGainNode());

    activeAudio.src = track.preview;
    try { activeAudio.currentTime = 0; } catch {}
    resetGainNode(activeGainNode());

    updateMediaSession(track);
    if (window.PocuStore) window.PocuStore.recent.add(track.id);
    resumeAudioCtx();
    try { await activeAudio.play(); }
    catch (e) { if (e.name === 'AbortError') return; console.warn('[player] play failed', e); }
  }

  async function play(track) {
    if (!track || !track.preview) return;
    if (current && current.id === track.id) {
      if (activeAudio.paused) {
        resumeAudioCtx();
        try { await activeAudio.play(); } catch (e) { if (e.name !== 'AbortError') console.warn(e); }
      } else {
        activeAudio.pause();
      }
      return;
    }
    queue = [track]; queueIndex = 0; shuffledOrder = null;
    current = track;

    cancelCrossfade();
    markNewTrack(track);

    cleanupElement(otherAudio());
    resetGainNode(otherGainNode());

    activeAudio.src = track.preview;
    try { activeAudio.currentTime = 0; } catch {}
    resetGainNode(activeGainNode());

    updateMediaSession(track);
    if (window.PocuStore) window.PocuStore.recent.add(track.id);
    resumeAudioCtx();
    try { await activeAudio.play(); }
    catch (e) { if (e.name === 'AbortError') return; console.warn('[player] play failed', e); }
  }

  function insertNext(track) {
    if (!track || !track.preview) return;
    if (!current) { play(track); return; }
    if (current.id === track.id) return;
    if (shuffle && !shuffledOrder) shuffledOrder = buildShuffledOrder(queueIndex);

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

    const insertPos = queueIndex + 1;
    queue.splice(insertPos, 0, track);

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
    cancelCrossfade();
    if (repeat === 'one') {
      try { activeAudio.currentTime = 0; } catch {}
      activeAudio.play().catch(() => {});
      return;
    }
    const idx = findNextIndex();
    if (idx < 0) { activeAudio.pause(); return; }
    queueIndex = idx;
    playCurrentInQueue();
  }

  function prev() {
    if (activeAudio.currentTime > 3) { activeAudio.currentTime = 0; return; }
    if (!queue.length) return;
    cancelCrossfade();
    const idx = findPrevIndex();
    if (idx < 0) { activeAudio.currentTime = 0; return; }
    queueIndex = idx;
    playCurrentInQueue();
  }

  function togglePlay() {
    if (!current) return;
    cancelCrossfade();
    resumeAudioCtx();
    if (activeAudio.paused) activeAudio.play().catch(() => {});
    else activeAudio.pause();
  }

  function seek(seconds) {
    if (!current || !isFinite(activeAudio.duration)) return;
    cancelCrossfade();
    activeAudio.currentTime = Math.max(0, Math.min(seconds, activeAudio.duration));
  }

  function setShuffle(v) { shuffle = !!v; shuffledOrder = shuffle ? buildShuffledOrder(queueIndex) : null; notify(); }
  function setRepeat(mode) { if (!['off','all','one'].includes(mode)) return; repeat = mode; notify(); }
  function toggleShuffle() { setShuffle(!shuffle); }
  function cycleRepeat() { const order=['off','all','one']; setRepeat(order[(order.indexOf(repeat)+1)%order.length]); }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (volume > 0) muted = false;
    if (masterGain) {
      masterGain.gain.value = muted ? 0 : volume;
      audioA.volume = 1; audioB.volume = 1;
      audioA.muted = false; audioB.muted = false;
    } else {
      audioA.volume = volume; audioB.volume = volume;
    }
    try { localStorage.setItem('pocu.volume', String(volume)); } catch {}
    notify();
  }

  function toggleMute() {
    muted = !muted;
    if (masterGain) {
      masterGain.gain.value = muted ? 0 : volume;
    } else {
      audioA.muted = muted; audioB.muted = muted;
    }
    notify();
  }

  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title, artist: track.artist, album: track.album || '',
        artwork: track.artwork ? [{ src: track.artwork, sizes: '512x512', type: 'image/jpeg' }] : []
      });
    } catch (e) {}
  }

  function setupMediaHandlers() {
    if (!('mediaSession' in navigator)) return;
    try {
      // play / pause
      navigator.mediaSession.setActionHandler('play', () => {
        ensureContextRunning();
        if (!current) return;
        if (activeAudio.paused) activeAudio.play().catch(() => {});
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (!current) return;
        if (!activeAudio.paused) activeAudio.pause();
      });

      // next / prev — перерегистрируем при каждом старте
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('previoustrack', prev);

      // seek-обработчики НЕ регистрируем (иначе iOS спрячет next/prev)
      // navigator.mediaSession.setActionHandler('seekto', ...);  // намеренно отключено
    } catch (e) {
      console.warn('[mediaSession] handler setup failed', e);
    }
  }

  function setPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    if (!current) {
      // Нет трека — только тогда 'none'
      navigator.mediaSession.playbackState = 'none';
    } else {
      // Существующий трек: никогда не 'none', только 'paused' или 'playing'
      navigator.mediaSession.playbackState = activeAudio.paused ? 'paused' : 'playing';
    }
    // Микро-толчок для некоторых браузеров:
    if (current && !activeAudio.paused) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  function updatePositionState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!current || !isFinite(activeAudio.duration) || activeAudio.duration === 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: activeAudio.duration, playbackRate: 1,
        position: Math.min(activeAudio.currentTime, activeAudio.duration)
      });
    } catch (e) {}
  }

  function onTimeUpdate(el) {
    if (el !== activeAudio) return;
    if (!current) return;

    // Держим AudioContext живым, пока трек играет
    ensureContextRunning();

    const t = el.currentTime;
    if (t > prevMaxTime) prevMaxTime = t;
    if (t >= 30 && !played30.has(current.id)) {
      played30.add(current.id);
      window.PocuStore?.skipStats?.recordPlay(current.id);
    }
    if (!isCrossfading) {
      const cf = getCrossfadeTime();
      if (cf > 0 && repeat !== 'one' && el.duration && isFinite(el.duration)) {
        const remaining = el.duration - el.currentTime;
        if (remaining > 0.2 && remaining <= cf + 0.5) {
          const fadeTime = Math.max(1, Math.min(cf, remaining - 0.2));
          startCrossfade(fadeTime);
        }
      }
    }
    updatePositionState();
    notify();
  }

  function onEnded(el) {
    if (el !== activeAudio) return;
    if (isCrossfading) return;

    if (current) {
      try { window.PocuStore?.skipStats?.recordComplete?.(current.id); } catch {}
    }

    if (repeat === 'one') { el.currentTime = 0; el.play().catch(() => {}); }
    else next();
  }

  function bindAudioEvents(el) {
    ['loadedmetadata', 'error', 'seeked'].forEach(ev => {
      el.addEventListener(ev, () => {
        if (el !== activeAudio) return;
        setPlaybackState();
        if (ev === 'loadedmetadata') updatePositionState();
        notify();
      });
    });
    el.addEventListener('play', () => {
      ensureContextRunning();
      setupMediaHandlers();
      if (el !== activeAudio) return;
      setPlaybackState();
      notify();
    });
    el.addEventListener('pause', () => {
      if (el !== activeAudio) return;
      setPlaybackState();
      notify();
    });
    el.addEventListener('timeupdate', () => onTimeUpdate(el));
    el.addEventListener('ended', () => onEnded(el));
  }

  bindAudioEvents(audioA);
  bindAudioEvents(audioB);

  /* === Глобальные авторезюмы AudioContext === */
  document.addEventListener('visibilitychange', () => {
    ensureContextRunning();
  });
  window.addEventListener('pageshow', () => {
    ensureContextRunning();
  });
  window.addEventListener('focus', () => {
    ensureContextRunning();
  });

  setInterval(() => {
    if (!audioCtx || !current || activeAudio.paused) return;
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      audioCtx.resume().catch(() => {});
    }
  }, 2000);

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
    get audio()  { return activeAudio; },
    get audioA() { return audioA; },
    get audioB() { return audioB; },
    get current() { return current; },
    getState,
    subscribe(fn) { listeners.add(fn); fn(getState()); return () => listeners.delete(fn); }
  };
})();