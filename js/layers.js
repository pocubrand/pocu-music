/* Pocu Music — Менеджер слоёв (z-index) */
window.PocuLayers = (() => {
  // Открытые оверлеи. Порядок в селекторе не важен — важен только факт «.open».
  const SELECTOR = [
    '.playlist-overlay.open',
    '.artist-overlay.open',
    '.track-overlay.open',
    '.album-overlay.open',
    '.genre-overlay.open'
  ].join(', ');

  const BASE_Z = 80;
  const MAX_Z  = 94; // сайдбар=95, мини-плеер=96, now-playing=100

  return {
    front(el) {
      if (!el) return;

      // Смотрим, какой сейчас самый высокий z-index среди ДРУГИХ открытых страниц
      let maxZ = BASE_Z;
      document.querySelectorAll(SELECTOR).forEach(o => {
        if (o === el) return;
        const z = parseInt(o.style.zIndex, 10);
        if (Number.isFinite(z) && z > maxZ) maxZ = z;
      });

      // Новая страница встаёт на 1 выше (но не перепрыгивает MAX_Z)
      el.style.zIndex = Math.min(MAX_Z, maxZ + 1);
    }
  };
})();