/* Pocu Music — Pulse Insights panel («Pulse о вас») */
window.PocuPulseInsightsUI = (() => {
  let els = {};
  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    const sheet = document.createElement('div');
    sheet.className = 'sheet-overlay';
    sheet.id = 'sheet-pulse-insights';
    sheet.innerHTML = `
      <div class="sheet-panel sheet-panel--tall">
        <div class="sheet-header"><h2>Pulse о вас</h2></div>
        <div class="sheet-body sheet-body--scroll">
          <div class="pulse-insights-hero" id="pulseInsightsHero"></div>
          <div class="pulse-insights-list" id="pulseInsightsList"></div>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-secondary" id="pulseInsightsClose">Закрыть</button>
        </div>
      </div>
    `;
    document.body.appendChild(sheet);

    els = {
      sheet,
      hero:    sheet.querySelector('#pulseInsightsHero'),
      list:    sheet.querySelector('#pulseInsightsList'),
      closeBtn: sheet.querySelector('#pulseInsightsClose')
    };

    els.closeBtn.addEventListener('click', close);
    els.sheet.addEventListener('click', e => { if (e.target === els.sheet) close(); });
  }

  function open() {
    if (!initialized) init();
    render();
    els.sheet.classList.add('open');
  }

  function close() { els.sheet.classList.remove('open'); }

  function render() {
    if (!window.PocuPulse?.getAllInsights) return;

    const insight = window.PocuPulse.getInsight();
    const all     = window.PocuPulse.getAllInsights();

    els.hero.innerHTML = `
      <div class="pulse-insights-hero-icon">${insight.icon}</div>
      <div class="pulse-insights-hero-text">
        <div class="pulse-insights-hero-title">${esc(insight.text)}</div>
        <div class="pulse-insights-hero-detail">${esc(insight.detail || '')}</div>
      </div>
    `;

    els.list.replaceChildren();
    all.forEach(item => {
      const row = document.createElement('div');
      row.className = 'pulse-insights-row';
      row.innerHTML = `
        <div class="pulse-insights-row-icon">${item.icon}</div>
        <div class="pulse-insights-row-main">
          <div class="pulse-insights-row-title">${esc(item.title)}</div>
          <div class="pulse-insights-row-detail">${esc(item.detail || '')}</div>
        </div>
        <div class="pulse-insights-row-value">${esc(item.value || '')}</div>
      `;
      els.list.appendChild(row);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  return { init, open, close };
})();