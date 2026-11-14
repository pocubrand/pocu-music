/* Pocu Music — Эквалайзер: popover на ПК, sheet на мобилке */
window.PocuEquilizerUI = (() => {
  let els = {};
  let initialized = false;
  let closingTimer = null;

  const PRESETS = {
    'Flat':       [0, 0, 0, 0, 0],
    'Bass':       [8, 5, 0, -1, -2],
    'Vocal':      [-2, 0, 4, 5, 2],
    'Rock':       [5, 3, -1, 3, 5],
    'Pop':        [-1, 2, 4, 2, -1],
    'Electronic': [6, 3, 0, 3, 6]
  };

  const LABELS = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];

  function isDesktop() {
    return window.matchMedia('(min-width: 900px)').matches;
  }

  function init() {
    if (initialized) return;
    initialized = true;

    const sheet = document.createElement('div');
    sheet.className = 'sheet-overlay';
    sheet.id = 'sheet-eq';
    sheet.innerHTML = `
      <div class="sheet-panel">
        <div class="sheet-header"><h2>Эквалайзер</h2></div>
        <div class="sheet-body">
          <div class="eq-presets" id="eqPresets"></div>
          <div class="eq-bands" id="eqBands"></div>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-secondary" id="eqResetBtn">Сброс</button>
          <button class="btn btn-primary" id="eqSaveBtn">Готово</button>
        </div>
      </div>
    `;
    document.body.appendChild(sheet);

    els = {
      sheet,
      panel:   sheet.querySelector('.sheet-panel'),
      presets: sheet.querySelector('#eqPresets'),
      bands:   sheet.querySelector('#eqBands'),
      reset:   sheet.querySelector('#eqResetBtn'),
      save:    sheet.querySelector('#eqSaveBtn')
    };

    // Пресеты
    Object.keys(PRESETS).forEach(name => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = name;
      b.addEventListener('click', () => {
        applyBands(PRESETS[name]);
        updateSliders(PRESETS[name]);
      });
      els.presets.appendChild(b);
    });

    // Слайдеры
    els.bands.replaceChildren();
    LABELS.forEach((label, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'eq-band';

      const val = document.createElement('div');
      val.className = 'eq-val';
      val.textContent = '0';

      const input = document.createElement('input');
      input.type = 'range';
      input.min = -12; input.max = 12; input.step = 1; input.value = 0;
      input.dataset.band = i;
      input.className = 'eq-slider';

      input.addEventListener('input', () => {
        val.textContent = String(input.value);
        applyBands(readSliders());
      });

      const name = document.createElement('div');
      name.className = 'eq-label';
      name.textContent = label;

      wrap.append(val, input, name);
      els.bands.appendChild(wrap);
    });

    els.save.addEventListener('click', close);
    els.reset.addEventListener('click', () => {
      applyBands([0,0,0,0,0]);
      updateSliders([0,0,0,0,0]);
    });

    els.sheet.addEventListener('click', e => { if (e.target === els.sheet) close(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && els.sheet.classList.contains('open')) close();
    });

    // Любые кнопки эквалайзера
    document.addEventListener('click', e => {
      const btn = e.target.closest('#npEq, #mpEq, [data-eq-btn]');
      if (!btn) return;
      e.stopPropagation();
      open(btn);
    });

    window.addEventListener('resize', () => {
      if (els.sheet.classList.contains('open')) close();
    });
  }

  function open(anchorEl) {
    if (!initialized) init();
    // Ждём окончания анимации закрытия, чтобы не мигало
    if (closingTimer) return;
    if (els.sheet.classList.contains('open')) return;

    const saved = window.PocuStore.settings.get('eq', [0,0,0,0,0]);
    updateSliders(saved);

    if (isDesktop() && anchorEl) {
      // ПК: popover над иконкой
      els.sheet.classList.add('as-popover');
      void els.panel.offsetWidth;
      els.sheet.classList.add('open');
      requestAnimationFrame(() => positionPopover(anchorEl));
    } else {
      // Мобилка: sheet снизу
      els.sheet.classList.remove('as-popover');
      els.panel.style.left = '';
      els.panel.style.top = '';
      els.sheet.classList.add('open');
    }
  }

  function positionPopover(anchorEl) {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const rect = els.panel.getBoundingClientRect();
    const pw = rect.width || 280;
    const ph = rect.height || 320;

    let left = r.left + r.width / 2 - pw / 2;
    let top  = r.top - ph - 10;

    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    top  = Math.max(8, top);

    els.panel.style.left = left + 'px';
    els.panel.style.top  = top + 'px';
  }

  function readSliders() {
    const out = [0,0,0,0,0];
    els.bands.querySelectorAll('.eq-slider').forEach(inp => {
      out[Number(inp.dataset.band)] = Number(inp.value);
    });
    return out;
  }

  function updateSliders(bands) {
    els.bands.querySelectorAll('.eq-slider').forEach(inp => {
      const i = Number(inp.dataset.band);
      inp.value = bands[i];
      const valEl = inp.parentElement.querySelector('.eq-val');
      if (valEl) valEl.textContent = String(bands[i]);
    });
  }

  function applyBands(bands) {
    window.PocuPlayer.setEQ(bands);
    // settings.set без notify — рекомендации не дёргаются
    window.PocuStore.settings.set('eq', bands);
  }

  function close() {
    if (!els.sheet || !els.sheet.classList.contains('open')) return;
    els.sheet.classList.remove('open');
    // Блокируем клики сквозь overlay, пока идёт анимация
    els.sheet.style.pointerEvents = 'none';
    clearTimeout(closingTimer);
    closingTimer = setTimeout(() => {
      els.sheet.style.pointerEvents = '';
      els.sheet.classList.remove('as-popover');
      els.panel.style.left = '';
      els.panel.style.top = '';
      closingTimer = null;
    }, 250);
  }

  return { init, open, close };
})();