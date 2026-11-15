/* Pocu Music — Менеджер слоев (Z-index) */
window.PocuLayers = (() => {
  let topZ = 80; // Базовый z-index (все оверлеи в CSS начинаются с 80)

  return {
    // Поднимает элемент на самый верхний слой
    front(el) {
      if (!el) return;
      topZ++;
      el.style.zIndex = topZ;
    }
  };
})();