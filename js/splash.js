/* Pocu Music — Splash + Welcome (первый заход) */
window.PocuSplash = (() => {
  const GUEST_KEY = 'pocu.guest.v1';
  const SPLASH_MS = 2400;      // сколько splash держим (включая CSS fade-out)
  const AUTH_WAIT_MS = 3200;   // сколько ждём INITIAL_SESSION перед тем как решить

  let authResolved = false;
  let currentUser = null;
  let welcomeShown = false;
  let welcomeAllowed = false;

  function init() {
    // Если splash выключен в настройках — не показываем ни splash, ни welcome.
    // CSS уже скрыл их через [data-splash="off"], JS просто не запускает логику.
    if (document.documentElement.dataset.splash === 'off') {
      const splashEl = document.getElementById('splashScreen');
      if (splashEl) splashEl.style.display = 'none';
      const welcomeEl = document.getElementById('welcomeScreen');
      if (welcomeEl) welcomeEl.hidden = true;
      return;
    }

    // Слушаем auth-событие от supabase.js (диспатчится при INITIAL_SESSION / SIGNED_IN)
    document.addEventListener('pocu:auth', onAuth);

    // Fallback: если Supabase молчит дольше AUTH_WAIT_MS — считаем что гость
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
      // Успешный вход: закрываем welcome и убираем режим welcome-mode у sheet-auth
      closeWelcome();
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
    if (!el) return;
    // CSS сам начнёт fade-out через 1.8 сек.
    // JS убирает элемент из DOM на всякий случай через SPLASH_MS.
    setTimeout(() => {
      el.classList.add('gone');
      setTimeout(() => { el.style.display = 'none'; }, 500);
      welcomeAllowed = true;
      maybeShowWelcome();
    }, SPLASH_MS - 500);
  }

  function maybeShowWelcome() {
    if (welcomeShown) return;
    if (!welcomeAllowed) return;      // ждём окончания splash
    if (!authResolved) return;        // ждём auth
    if (currentUser) return;          // уже залогинен
    if (isGuest()) return;            // уже выбрал гостя

    showWelcome();
  }

  function showWelcome() {
    welcomeShown = true;
    const el = document.getElementById('welcomeScreen');
    if (!el) return;
    el.hidden = false;
    // requestAnimationFrame — чтобы transition сработал после снятия hidden
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('visible'));
    });
  }

  function closeWelcome() {
    const el = document.getElementById('welcomeScreen');
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(() => { el.hidden = true; }, 450);
  }

  function isGuest() {
    try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; }
  }

  function setGuest() {
    try { localStorage.setItem(GUEST_KEY, '1'); } catch {}
  }

  function bindButtons() {
    const guestBtn = document.getElementById('welcomeGuestBtn');
    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        setGuest();
        closeWelcome();
      });
    }

    const loginBtn = document.getElementById('welcomeLoginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        const sheet = document.getElementById('sheet-auth');
        if (!sheet) return;
        // Прячем кнопки welcome — на их месте появится форма
        document.querySelectorAll('.welcome-btn').forEach(b => b.style.display = 'none');
        sheet.classList.add('welcome-mode');
        sheet.classList.add('open');
      });
    }

    // При любом закрытии sheet-auth (Отмена, backdrop, submit) —
    // возвращаем кнопки welcome и убираем welcome-mode
    const sheet = document.getElementById('sheet-auth');
    if (sheet) {
      const observer = new MutationObserver(() => {
        if (sheet.classList.contains('welcome-mode') && !sheet.classList.contains('open')) {
          sheet.classList.remove('welcome-mode');
          document.querySelectorAll('.welcome-btn').forEach(b => b.style.display = '');
        }
      });
      observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
    }
  }

  return { init };
})();

// Автоинициализация (скрипт подключён в конце body — DOM уже готов)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.PocuSplash.init());
} else {
  window.PocuSplash.init();
}