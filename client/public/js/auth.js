/**
 * auth.js — вход и регистрация на login.html.
 *
 * Приоритет: реальный бэкенд (/api/auth/*).
 * Моки в localStorage используются только если сервер недоступен
 * (err.isNetworkError === true). Любая HTTP-ошибка от сервера
 * (400/401/409/500) показывается пользователю как есть.
 *
 * Демо-аккаунты для fallback: admin@coffee.ru / admin123 (админ),
 * user@coffee.ru / user123.
 */

const MOCK_USERS = [
  { id: 1, name: 'Администратор', email: 'admin@coffee.ru', password: 'admin123', role: 'admin' },
  { id: 2, name: 'Степан',        email: 'user@coffee.ru',  password: 'user123',  role: 'user'  },
];

(function () {
  function getUsers() {
    const local = localStorage.getItem('mock_users');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return [...MOCK_USERS, ...parsed];
      } catch { /* ignore */ }
    }
    return [...MOCK_USERS];
  }

  function saveExtraUser(user) {
    const local = localStorage.getItem('mock_users');
    let list = [];
    if (local) {
      try { list = JSON.parse(local) || []; } catch { list = []; }
    }
    list.push(user);
    localStorage.setItem('mock_users', JSON.stringify(list));
  }

  function showError(form, message) {
    const el = form.querySelector('[data-error]');
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }

  function clearError(form) { showError(form, ''); }

  function redirectAfterAuth(user) {
    if (user.role === 'admin') {
      location.href = '/admin/dashboard.html';
    } else {
      const back = new URLSearchParams(location.search).get('next');
      location.href = back || '/';
    }
  }

  /* ---------- Табы login/register ---------- */
  function bindTabs() {
    const tabs = document.querySelectorAll('[data-tab]');
    const forms = document.querySelectorAll('[data-form]');
    if (!tabs.length || !forms.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const name = tab.getAttribute('data-tab');
        tabs.forEach((t) => {
          const active = t === tab;
          t.classList.toggle('btn--primary', active);
          t.classList.toggle('btn--secondary', !active);
          t.setAttribute('aria-selected', String(active));
        });
        forms.forEach((f) => {
          f.hidden = f.getAttribute('data-form') !== name;
          clearError(f);
        });
      });
    });
  }

  /* ---------- Логин ---------- */
  function bindLogin() {
    const form = document.querySelector('[data-form="login"]');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError(form);

      const email = form.querySelector('[name="email"]').value.trim();
      const password = form.querySelector('[name="password"]').value;
      if (!email || !password) {
        showError(form, 'Заполните email и пароль');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        // Реальный бэкенд
        const data = await window.api.post('/auth/login', { email, password });
        window.api.setToken(data.token);
        window.api.setUser(data.user);
        window.dispatchEvent(new Event('auth:login'));
        window.showToast?.(`Добро пожаловать, ${data.user.name || data.user.email}!`);
        redirectAfterAuth(data.user);
      } catch (err) {
        // HTTP-ошибка от сервера — показываем её, моки НЕ используем
        if (!err.isNetworkError) {
          showError(form, err.message || 'Не удалось войти');
          submitBtn.disabled = false;
          return;
        }

        // Сервер недоступен — fallback на моки
        const user = getUsers().find(
          (u) => u.email === email && u.password === password
        );
        if (!user) {
          showError(form, 'Неверный email или пароль');
          submitBtn.disabled = false;
          return;
        }
        const { password: _pw, ...safeUser } = user;
        window.api.setToken('mock-token-' + user.id);
        window.api.setUser(safeUser);
        window.dispatchEvent(new Event('auth:login'));
        window.showToast?.(`Добро пожаловать, ${safeUser.name}!`);
        redirectAfterAuth(safeUser);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  /* ---------- Регистрация ---------- */
  function bindRegister() {
    const form = document.querySelector('[data-form="register"]');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError(form);

      const name = form.querySelector('[name="name"]').value.trim();
      const email = form.querySelector('[name="email"]').value.trim();
      const password = form.querySelector('[name="password"]').value;

      if (!name || !email || !password) {
        showError(form, 'Заполните все поля');
        return;
      }
      if (password.length < 6) {
        showError(form, 'Пароль должен быть не короче 6 символов');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        const data = await window.api.post('/auth/register', { name, email, password });
        window.api.setToken(data.token);
        window.api.setUser(data.user);
        window.dispatchEvent(new Event('auth:login'));
        window.showToast?.(`Аккаунт создан. Добро пожаловать, ${data.user.name}!`);
        redirectAfterAuth(data.user);
      } catch (err) {
        // HTTP-ошибка от сервера — показываем её, моки НЕ используем
        if (!err.isNetworkError) {
          showError(form, err.message || 'Не удалось зарегистрироваться');
          submitBtn.disabled = false;
          return;
        }

        // Сервер недоступен — fallback на локальную регистрацию
        if (getUsers().some((u) => u.email === email)) {
          showError(form, 'Пользователь с таким email уже существует');
          submitBtn.disabled = false;
          return;
        }

        const newUser = {
          id: Date.now(),
          name,
          email,
          password,
          role: 'user',
        };
        saveExtraUser(newUser);
        const { password: _pw, ...safeUser } = newUser;
        window.api.setToken('mock-token-' + newUser.id);
        window.api.setUser(safeUser);
        window.dispatchEvent(new Event('auth:login'));
        window.showToast?.('Аккаунт создан (локально)');
        redirectAfterAuth(safeUser);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function init() {
    bindTabs();
    bindLogin();
    bindRegister();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();