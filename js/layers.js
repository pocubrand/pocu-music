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

  /* Эффективный z-index: инлайн, если есть, иначе computed из CSS. */
  function effectiveZ(el) {
    const inline = parseInt(el.style.zIndex, 10);
    if (Number.isFinite(inline)) return inline;
    const computed = parseInt(getComputedStyle(el).zIndex, 10);
    if (Number.isFinite(computed)) return computed;
    return 0;
  }

  return {
    // Поднимает элемент на самый верх (но не выше MAX_Z)
    front(el) {
      if (!el) return;

      let maxZ = BASE_Z;
      document.querySelectorAll(SELECTOR).forEach(o => {
        if (o === el) return;
        const z = effectiveZ(o);
        if (z > maxZ) maxZ = z;
      });

      el.style.zIndex = Math.min(MAX_Z, maxZ + 1);
    },

    // Сбрасывает z-index (вызывать при закрытии)
    reset(el) {
      if (el) el.style.zIndex = '';
    },

    // Отладка: PocuLayers.debug() в консоли
    debug() {
      const rows = [];
      document.querySelectorAll(
        '.playlist-overlay, .artist-overlay, .track-overlay, .album-overlay, .genre-overlay'
      ).forEach(o => {
        rows.push({
          id:       o.id,
          open:     o.classList.contains('open'),
          inline:   o.style.zIndex || '(none)',
          computed: getComputedStyle(o).zIndex,
          parent:   o.parentElement?.tagName || '(none)',
          display:  getComputedStyle(o).display
        });
      });
      console.table(rows);
      return rows;
    }
  };
})();