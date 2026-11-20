/* Pocu Music — Splash + Welcome (первый заход) */
window.PocuSplash = (() => {
  const GUEST_KEY = 'pocu.guest.v1';
  const SPLASH_MS    = 3200;   // длительность splash (синхронизировано с css/app.css)
  const AUTH_WAIT_MS = 3200;   // ждём INITIAL_SESSION не дольше этого

  let authResolved = false;
  let currentUser = null;
  let welcomeShown = false;
  let welcomeAllowed = false;

  function init() {
    // Если splash выключен в настройках — сразу app, никаких задержек
    if (document.documentElement.dataset.splash === 'off') {
      const splashEl = document.getElementById('splashScreen');
      if (splashEl) splashEl.style.display = 'none';
      const welcomeEl = document.getElementById('welcomeScreen');
      if (welcomeEl) welcomeEl.hidden = true;
      document.documentElement.dataset.boot = 'app';
      return;
    }

    document.addEventListener('pocu:auth', onAuth);

    // Если auth молчит — считаем гостем
    setTimeout(() => {
      if (!authResolved) {
        authResolved = true;
        currentUser = null;
      }
      maybeShowWelcome();
    }, AUTH_WAIT_MS);

    bindButtons();
    hideSplashAfterDelay();
  }

  function onAuth(e) {
    authResolved = true;
    currentUser = (e.detail && e.detail.user) || null;

    if (currentUser) {
      try { localStorage.removeItem(GUEST_KEY); } catch {}
      if (welcomeShown) closeWelcome();
      const sheet = document.getElementById('sheet-auth');
      if (sheet) {
        sheet.classList.remove('welcome-mode');
        sheet.classList.remove('open');
      }
    }
    maybeShowWelcome();
  }

  function hideSplashAfterDelay() {
    const el = document.getElementById('splashScreen');
    if (!el) {
      document.documentElement.dataset.boot = 'app';
      return;
    }

    // За 500ms до полного исчезновения splash — решаем, что показать:
    // welcome или сразу app. Welcome появляется под fade-out'ящимся splash —
    // мигания нет.
    setTimeout(() => {
      welcomeAllowed = true;
      maybeShowWelcome();
    }, SPLASH_MS - 500);

    // Через SPLASH_MS splash полностью убираем из DOM.
    // CSS-анимация к этому моменту уже сделала fade-out (2.6s + 0.6s = 3.2s).
    setTimeout(() => {
      el.classList.add('gone');
      el.style.display = 'none';
    }, SPLASH_MS);
  }

  function maybeShowWelcome() {
    if (welcomeShown) return;
    if (!welcomeAllowed) return;   // ждём окончания splash
    if (!authResolved) return;     // ждём auth

    // Welcome не нужен — показываем приложение
    if (currentUser || isGuest()) {
      document.documentElement.dataset.boot = 'app';
      return;
    }

    showWelcome();
  }

  function showWelcome() {
    welcomeShown = true;
    const el = document.getElementById('welcomeScreen');
    if (!el) {
      document.documentElement.dataset.boot = 'app';
      return;
    }
    // main всё ещё скрыт — переключаем boot на welcome
    document.documentElement.dataset.boot = 'welcome';
    el.hidden = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('visible'));
    });
  }

  function closeWelcome() {
    const el = document.getElementById('welcomeScreen');
    if (!el) {
      document.documentElement.dataset.boot = 'app';
      return;
    }
    el.classList.remove('visible');
    setTimeout(() => {
      el.hidden = true;
      // main показываем только после того, как welcome полностью исчез —
      // иначе будет просвечивать через fade-out welcome.
      document.documentElement.dataset.boot = 'app';
    }, 450);
  }

  function isGuest() {
    try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; }
  }

  function setGuest() {
    try { localStorage.setItem(GUEST_KEY, '1'); } catch {}
  }

  function bindButtons() {
    const guestBtn = document.getElementById('welcomeGuestBtn');
    const loginBtn = document.getElementById('welcomeLoginBtn');
    const welcomeEl = document.getElementById('welcomeScreen');
    const sheet = document.getElementById('sheet-auth');

    function enterFormMode() {
      if (!welcomeEl || !sheet) return;
      const content = welcomeEl.querySelector('.welcome-content');

      welcomeEl.classList.add('form-mode');
      document.querySelectorAll('.welcome-btn').forEach(b => b.style.display = 'none');

      // Переносим sheet-auth внутрь welcome-content — теперь это потоковый блок
      if (content && sheet.parentElement !== content) {
        content.appendChild(sheet);
      }
      sheet.classList.add('welcome-mode');
      sheet.classList.add('open');
    }

    function exitFormMode() {
      if (!welcomeEl || !sheet) return;
      welcomeEl.classList.remove('form-mode');
      document.querySelectorAll('.welcome-btn').forEach(b => b.style.display = '');

      // Возвращаем sheet-auth обратно в body — он снова обычный оверлей
      if (sheet.parentElement !== document.body) {
        document.body.appendChild(sheet);
      }
      sheet.classList.remove('welcome-mode');
    }

    guestBtn?.addEventListener('click', () => {
      setGuest();
      closeWelcome();
    });

    loginBtn?.addEventListener('click', enterFormMode);

    if (sheet) {
      const observer = new MutationObserver(() => {
        if (sheet.classList.contains('welcome-mode') && !sheet.classList.contains('open')) {
          exitFormMode();
        }
      });
      observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
    }
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.PocuSplash.init());
} else {
  window.PocuSplash.init();
}