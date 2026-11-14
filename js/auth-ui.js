/* Pocu Music — UI авторизации */
window.PocuAuthUI = (() => {
  let isLoginMode = true;
  let els = {};

  function init() {
    els = {
      sheet:        document.getElementById('sheet-auth'),
      title:        document.getElementById('authTitle'),
      error:        document.getElementById('authError'),
      email:        document.getElementById('authEmail'),
      pass:         document.getElementById('authPassword'),
      switchText:   document.getElementById('authSwitchText'),
      switchBtn:    document.getElementById('authSwitchBtn'),
      cancelBtn:    document.getElementById('authCancelBtn'),
      submitBtn:    document.getElementById('authSubmitBtn'),
      forgotBtn:    document.getElementById('authForgotBtn'),
      // recovery
      rSheet:       document.getElementById('sheet-recovery'),
      rPass:        document.getElementById('recoveryPassword'),
      rPassConfirm: document.getElementById('recoveryPasswordConfirm'),
      rError:       document.getElementById('recoveryError'),
      rSuccess:     document.getElementById('recoverySuccess'),
      rSubmit:      document.getElementById('recoverySubmitBtn')
    };

    els.cancelBtn?.addEventListener('click', closeAuthSheet);
    els.sheet?.addEventListener('click', e => { if (e.target === els.sheet) closeAuthSheet(); });

    els.switchBtn?.addEventListener('click', () => {
      isLoginMode = !isLoginMode;
      updateAuthMode();
    });

    els.submitBtn?.addEventListener('click', handleSubmit);
    els.forgotBtn?.addEventListener('click', handleForgotPassword);
    els.rSubmit?.addEventListener('click', handleRecoverySubmit);

    [els.email, els.pass].forEach(inp => {
      inp?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
      });
    });
    [els.rPass, els.rPassConfirm].forEach(inp => {
      inp?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); handleRecoverySubmit(); }
      });
    });

    document.addEventListener('pocu:auth', (e) => {
      if (e.detail.user) closeAuthSheet();
    });

    document.addEventListener('pocu:password-recovery', () => openRecoverySheet());
  }

  /* ============ ПУБЛИЧНЫЕ ============ */
  function openAuthSheet() {
    if (!els.sheet) return;
    els.email.value = '';
    els.pass.value = '';
    els.error.hidden = true;
    els.submitBtn.disabled = false;
    isLoginMode = true;
    updateAuthMode();
    els.sheet.classList.add('open');
    setTimeout(() => els.email.focus(), 100);
  }

  async function logout() {
    if (!confirm('Выйти из аккаунта?')) return;
    try { await window.PocuSupabase.signOut(); } catch (e) { console.error(e); }
  }

  function closeAuthSheet() { els.sheet?.classList.remove('open'); }

  function updateAuthMode() {
    els.error.hidden = true;
    if (isLoginMode) {
      els.title.textContent = 'Вход в аккаунт';
      els.submitBtn.textContent = 'Войти';
      els.switchText.textContent = 'Нет аккаунта?';
      els.switchBtn.textContent = 'Зарегистрироваться';
      els.pass.autocomplete = 'current-password';
    } else {
      els.title.textContent = 'Регистрация';
      els.submitBtn.textContent = 'Создать аккаунт';
      els.switchText.textContent = 'Уже есть аккаунт?';
      els.switchBtn.textContent = 'Войти';
      els.pass.autocomplete = 'new-password';
    }
  }

  async function handleSubmit() {
    if (els.submitBtn.disabled) return;

    const email = els.email.value.trim();
    const password = els.pass.value;

    if (!email || !password) { showError('Заполни email и пароль'); return; }
    if (password.length < 6) { showError('Пароль минимум 6 символов'); return; }

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = 'Загрузка...';
    els.error.hidden = true;

    try {
      if (isLoginMode) {
        await window.PocuSupabase.signIn(email, password);
      } else {
        await window.PocuSupabase.signUp(email, password);
        await window.PocuSupabase.signIn(email, password);
      }
    } catch (err) {
      showError(err.message || 'Ошибка авторизации');
    } finally {
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = isLoginMode ? 'Войти' : 'Создать аккаунт';
    }
  }

  async function handleForgotPassword() {
    const email = els.email.value.trim();
    if (!email) { showError('Введи email в поле выше'); return; }
    try {
      await window.PocuSupabase.resetPassword(email);
      showSuccess('Если аккаунт с таким email существует — мы отправили ссылку для сброса пароля. Проверь почту.');
    } catch (err) {
      showError(err.message || 'Не удалось отправить письмо');
    }
  }

  function openRecoverySheet() {
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.origin + window.location.pathname);
      }
    } catch {}

    els.rPass.value = '';
    els.rPassConfirm.value = '';
    els.rError.hidden = true;
    els.rSuccess.hidden = true;
    els.rSubmit.disabled = false;
    els.rSubmit.textContent = 'Сохранить';

    closeAuthSheet();
    els.rSheet.classList.add('open');
    setTimeout(() => els.rPass.focus(), 100);
  }

  async function handleRecoverySubmit() {
    const pass1 = els.rPass.value;
    const pass2 = els.rPassConfirm.value;

    if (!pass1 || pass1.length < 6) { showRecoveryError('Пароль минимум 6 символов'); return; }
    if (pass1 !== pass2) { showRecoveryError('Пароли не совпадают'); return; }

    els.rSubmit.disabled = true;
    els.rSubmit.textContent = 'Сохранение...';
    els.rError.hidden = true;

    try {
      await window.PocuSupabase.updatePassword(pass1);
      els.rSuccess.textContent = 'Пароль обновлён! Перенаправляем...';
      els.rSuccess.hidden = false;
      setTimeout(() => { els.rSheet.classList.remove('open'); location.reload(); }, 1500);
    } catch (err) {
      showRecoveryError(err.message || 'Не удалось обновить пароль');
      els.rSubmit.disabled = false;
      els.rSubmit.textContent = 'Сохранить';
    }
  }

  function showRecoveryError(msg) { els.rError.textContent = msg; els.rError.hidden = false; }
  function showError(msg) {
    els.error.textContent = msg;
    els.error.classList.remove('auth-success');
    els.error.classList.add('auth-error');
    els.error.hidden = false;
  }
  function showSuccess(msg) {
    els.error.textContent = msg;
    els.error.classList.remove('auth-error');
    els.error.classList.add('auth-success');
    els.error.hidden = false;
  }

  return { init, openAuthSheet, logout };
})();