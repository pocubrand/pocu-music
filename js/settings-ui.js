/* Pocu Music — страница «Настройки» */
window.PocuSettingsUI = (() => {
  let els = {};
  let initialized = false;
  let systemMql = null;

  function init() {
    if (initialized) return;
    initialized = true;

    els = {
      screen:         document.getElementById('settingsScreen'),
      backBtn:        document.getElementById('settingsBackBtn'),
      guestBlock:     document.getElementById('settingsGuestBlock'),
      userBlock:      document.getElementById('settingsUserBlock'),
      logoutWrap:     document.getElementById('settingsLogoutWrap'),
      userEmail:      document.getElementById('settingsUserEmail'),
      avatar:         document.getElementById('settingsAvatar'),
      avatarInput:    document.getElementById('settingsAvatarInput'),
      avatarBtn:      document.getElementById('settingsAvatarBtn'),
      nameInput:      document.getElementById('settingsNameInput'),
      saveName:       document.getElementById('settingsSaveName'),
      loginBtn:       document.getElementById('settingsLoginBtn'),
      logoutBtn:      document.getElementById('settingsLogoutBtn'),
      changePassBtn:  document.getElementById('settingsChangePassBtn'),
      toggleSmooth:   document.getElementById('settingsToggleSmooth'),
      eqBtn:          document.getElementById('settingsEqBtn'),
      prefsBtn:       document.getElementById('settingsPrefsBtn'),
      themePicker:    document.getElementById('settingsThemePicker'),
      tracksCount:    document.getElementById('settingsTracksCount'),
      favCount:       document.getElementById('settingsFavCount'),
      plCount:        document.getElementById('settingsPlCount'),
      albumsCount:    document.getElementById('settingsAlbumsCount'),
      artistsCount:   document.getElementById('settingsArtistsCount'),
      clearRecent:    document.getElementById('settingsClearRecent'),
      clearPulse:     document.getElementById('settingsClearPulse'),
      clearAll:       document.getElementById('settingsClearAll'),
      openTopbar:     document.getElementById('settingsBtn'),
      openSidebar:    document.getElementById('sidebarSettingsBtn')
    };

    els.openTopbar?.addEventListener('click', openScreen);
    els.openSidebar?.addEventListener('click', openScreen);
    els.backBtn?.addEventListener('click', closeScreen);

    els.loginBtn?.addEventListener('click', () => window.PocuAuthUI?.openAuthSheet?.());
    els.logoutBtn?.addEventListener('click', () => window.PocuAuthUI?.logout?.());
    els.changePassBtn?.addEventListener('click', handleChangePassword);

    els.avatarBtn?.addEventListener('click', () => els.avatarInput?.click());
    els.avatarInput?.addEventListener('change', handleAvatarChange);
    els.saveName?.addEventListener('click', handleSaveName);

    els.toggleSmooth?.addEventListener('change', () => {
      const v = els.toggleSmooth.checked;
      window.PocuStore.settings.set('smoothTransitions', v);
      document.body.classList.toggle('no-smooth', !v);
    });

    els.eqBtn?.addEventListener('click', () => window.PocuEquilizerUI?.open?.());
    els.prefsBtn?.addEventListener('click', () => window.PocuPreferencesUI?.open?.());

    els.clearRecent?.addEventListener('click', () => {
      if (!confirm('Очистить историю прослушиваний?')) return;
      window.PocuStore.recent.clear();
      refreshCounters();
    });
    els.clearPulse?.addEventListener('click', () => {
      if (!confirm('Сбросить статистику Pulse?')) return;
      const all = window.PocuStore.skipStats.all();
      Object.keys(all).forEach(k => delete all[k]);
      window.PocuStore.persist();
      refreshCounters();
    });
    els.clearAll?.addEventListener('click', () => {
      if (!confirm('Удалить ВСЁ? Необратимо.')) return;
      try { localStorage.removeItem('pocu.music.v1'); } catch {}
      location.reload();
    });

    /* ======== ТЕМА ======== */
    els.themePicker?.addEventListener('click', e => {
      const btn = e.target.closest('[data-theme-choice]');
      if (!btn) return;
      const choice = btn.dataset.themeChoice;
      if (!['dark', 'light', 'auto'].includes(choice)) return;
      window.PocuStore.settings.set('theme', choice);
      applyTheme(choice);
      watchSystemTheme(choice);
    });

    // Применяем тему при инициализации (inline-скрипт в <head> уже поставил
    // data-theme для анти-FOUC, здесь просто синхронизируем UI-состояние)
    const initialChoice = window.PocuStore.settings.get('theme', 'dark');
    applyTheme(initialChoice);
    watchSystemTheme(initialChoice);

    document.addEventListener('pocu:auth', () => { refreshAccount(); pullProfile(); });
    window.PocuStore.subscribe(() => { if (els.screen?.classList.contains('active')) refreshCounters(); });

    refreshAccount();
    refreshCounters();
  }

  /* ============ ТЕМА: применение / слушатель системы ============ */

  function applyTheme(choice) {
    let resolved = choice;
    if (choice === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    if (resolved !== 'light') resolved = 'dark';

    document.documentElement.dataset.theme = resolved;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'light' ? '#f2f2f5' : '#08080c';

    updateThemePicker(choice);
  }

  function updateThemePicker(choice) {
    if (!els.themePicker) return;
    els.themePicker.querySelectorAll('[data-theme-choice]').forEach(btn => {
      const isActive = btn.dataset.themeChoice === choice;
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
  }

  function onSystemThemeChange() {
    const choice = window.PocuStore.settings.get('theme', 'dark');
    if (choice === 'auto') applyTheme('auto');
  }

  function watchSystemTheme(choice) {
    if (systemMql) {
      try { systemMql.removeEventListener('change', onSystemThemeChange); } catch {}
      systemMql = null;
    }
    if (choice === 'auto' && window.matchMedia) {
      systemMql = window.matchMedia('(prefers-color-scheme: light)');
      if (systemMql.addEventListener) systemMql.addEventListener('change', onSystemThemeChange);
      else if (systemMql.addListener) systemMql.addListener(onSystemThemeChange); // Safari < 14
    }
  }

  /* ============ ЭКРАН ============ */

  function openScreen() {
    if (!els.screen) return;
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    els.screen.classList.add('active');
    document.body.classList.remove('np-open');
    refreshAccount();
    refreshCounters();
    pullProfile();
    // синхронизируем выбранную тему с UI
    updateThemePicker(window.PocuStore.settings.get('theme', 'dark'));
    document.getElementById('main')?.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function pullProfile() {
    const user = window.PocuSupabase?.getUser?.();
    if (!user) return;
    try {
      const data = await window.PocuSupabase.fetchProfile?.();
      if (!data) return;
      const cur = window.PocuStore.profile.get();
      if (data.displayName !== cur.displayName || data.avatarUrl !== cur.avatarUrl) {
        window.PocuStore.profile.set(data);
        refreshAccount();
      }
    } catch (e) { /* ignore */ }
  }

  function closeScreen() {
    document.querySelector('.tab-item[data-tab="home"]')?.click();
  }

  function refreshAccount() {
    const user = window.PocuSupabase?.getUser?.();
    const loggedIn = !!user;

    els.guestBlock.hidden = loggedIn;
    els.userBlock.hidden  = !loggedIn;
    els.logoutWrap.hidden = !loggedIn;

    if (loggedIn) {
      els.userEmail.textContent = user.email || '';
      const prof = window.PocuStore.profile.get();

      if (prof.avatarUrl) {
        els.avatar.style.backgroundImage = `url("${prof.avatarUrl}")`;
        els.avatar.textContent = '';
      } else {
        els.avatar.style.backgroundImage = '';
        els.avatar.textContent = (prof.displayName || user.email || '?').slice(0, 1).toUpperCase();
      }

      els.nameInput.value = prof.displayName || (user.email ? user.email.split('@')[0] : '');
    }

    const smooth = window.PocuStore.settings.get('smoothTransitions', true);
    if (els.toggleSmooth) els.toggleSmooth.checked = smooth;
    document.body.classList.toggle('no-smooth', !smooth);
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const size = 200;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Файл больше 5 МБ'); return; }

    try {
      const dataUrl = await compressImage(file);
      window.PocuStore.profile.set({ avatarUrl: dataUrl });
      refreshAccount();
      await window.PocuSupabase?.syncProfile?.({ avatarUrl: dataUrl });
      showToast('Аватар обновлён');
    } catch (err) {
      console.error(err);
      alert('Не удалось обработать изображение');
    }
  }

  async function handleSaveName() {
    const name = els.nameInput.value.trim();
    window.PocuStore.profile.set({ displayName: name });
    refreshAccount();
    await window.PocuSupabase?.syncProfile?.({ displayName: name });
    showToast('Имя сохранено');
  }

  function handleChangePassword() {
    const email = window.PocuSupabase.getUser()?.email;
    if (!email) return;
    if (!confirm('Отправить письмо для смены пароля на ' + email + '?')) return;
    window.PocuSupabase.resetPassword(email)
      .then(() => alert('Письмо отправлено'))
      .catch(e => alert('Ошибка: ' + e.message));
  }

  function refreshCounters() {
    if (els.tracksCount)  els.tracksCount.textContent  = String(window.PocuLibrary.all().length);
    if (els.favCount)     els.favCount.textContent     = String(window.PocuStore.favorites.all().length);
    if (els.plCount)      els.plCount.textContent      = String(window.PocuStore.playlists.all().length);
    if (els.albumsCount)  els.albumsCount.textContent  = String(window.PocuStore.favoriteAlbums.all().length);
    if (els.artistsCount) els.artistsCount.textContent = String(window.PocuStore.favoriteArtists.all().length);
  }

  function showToast(text) {
    const el = document.createElement('div');
    el.className = 'pulse-toast';
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 1800);
  }

  return { init };
})();