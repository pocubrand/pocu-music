/* Pocu Music — единый компонент пустых состояний */
window.PocuState = (() => {
  const ICONS = {
    music:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    heart:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.2s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.2 2.7c0 4.9-7.2 9.3-7.2 9.3z"/></svg>',
    vinyl:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>',
    playlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h10"/><circle cx="18" cy="16" r="3"/><path d="M21 16V8l-3 1"/></svg>',
    artist:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    history:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    chart:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
    star:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.9l-5.4 2.9 1-6.1L3.2 9.4l6.1-.9z"/></svg>',
    lock:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };

  function html(opts = {}) {
    const { iconName = '', title = '', sub = '', cta = null, compact = false } = opts;
    const classes = ['state-block'];
    if (compact) classes.push('state-block--compact');

    const iconHtml = iconName && ICONS[iconName]
      ? `<div class="state-block-icon">${ICONS[iconName]}</div>`
      : '';
    const subHtml = sub ? `<div class="state-sub">${escapeHtml(sub)}</div>` : '';
    const ctaHtml = cta
      ? `<button class="btn btn-primary state-block-cta" type="button"${cta.id ? ` id="${escapeAttr(cta.id)}"` : ''}>${escapeHtml(cta.label || '')}</button>`
      : '';

    return `<div class="${classes.join(' ')}">${iconHtml}<div class="state-title">${escapeHtml(title)}</div>${subHtml}${ctaHtml}</div>`;
  }

  function node(opts = {}) {
    const wrap = document.createElement('div');
    wrap.innerHTML = html(opts);
    const el = wrap.firstElementChild;
    const cta = el?.querySelector('.state-block-cta');
    if (cta && opts.cta?.onClick) cta.addEventListener('click', opts.cta.onClick);
    return el;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;');
  }

  return { html, node, icons: ICONS };
})();