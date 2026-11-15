/* Pocu Music — Менеджер слоёв (z-index) */
window.PocuLayers = (() => {
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
    // Поднимает элемент на самый верх (но не выше MAX_Z)
    front(el) {
      if (!el) return;

      let maxZ = BASE_Z;
      document.querySelectorAll(SELECTOR).forEach(o => {
        if (o === el) return;
        const z = parseInt(o.style.zIndex, 10);
        if (Number.isFinite(z) && z > maxZ) maxZ = z;
      });

      el.style.zIndex = Math.min(MAX_Z, maxZ + 1);
    },
    // Сбрасывает z-index (вызывать при закрытии)
    reset(el) {
      if (el) el.style.zIndex = '';
    }
  };
})();