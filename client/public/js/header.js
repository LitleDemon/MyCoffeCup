/**
 * header.js — общая логика шапки и футера.
 * - бургер-меню
 * - текущий год в футере
 * - счётчик корзины
 * - кнопка «Войти / Профиль» + кнопка «Выйти»
 * - динамическая ссылка «Мои заказы» в навигации для авторизованных
 * - showToast (общая утилита)
 */

(function () {
  /* ---------- 1. Бургер-меню ---------- */
  const burger = document.querySelector('[data-burger]');
  const nav = document.querySelector('.nav');

  if (burger && nav) {
    burger.addEventListener('click', () => nav.classList.toggle('nav--open'));

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => nav.classList.remove('nav--open'));
    });

    document.addEventListener('click', (e) => {
      if (
        nav.classList.contains('nav--open') &&
        !nav.contains(e.target) &&
        !burger.contains(e.target)
      ) {
        nav.classList.remove('nav--open');
      }
    });
  }

  /* ---------- 2. Год ---------- */
  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- 3. Счётчик корзины ---------- */
  const CART_KEY = 'cart';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
  }

  function updateCartCount() {
    const count = getCart().reduce((sum, item) => sum + (item.qty || 0), 0);
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  updateCartCount();
  window.addEventListener('cart:updated', updateCartCount);
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) updateCartCount();
  });

  /* ---------- 4. Кнопка «Войти / Профиль» + «Выйти» ---------- */
  function updateAuthLink() {
    const authLink = document.querySelector('[data-auth-link]');
    if (!authLink) return;

    document.querySelectorAll('[data-logout]').forEach((el) => el.remove());

    const token = localStorage.getItem('token');
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { user = null; }

    if (token && user) {
      const isAdmin = user.role === 'admin';
      authLink.textContent = isAdmin ? 'Админка' : (user.name || 'Профиль');
      authLink.href = isAdmin ? '/admin/dashboard.html' : '/profile.html';

      const logoutBtn = document.createElement('button');
      logoutBtn.type = 'button';
      logoutBtn.className = 'btn btn--ghost';
      logoutBtn.setAttribute('data-logout', '');
      logoutBtn.textContent = 'Выйти';
      logoutBtn.addEventListener('click', () => {
        window.api.logout();
        window.showToast?.('Вы вышли из аккаунта');
        if (location.pathname.startsWith('/admin')) {
          setTimeout(() => (location.href = '/'), 400);
        }
      });
      authLink.insertAdjacentElement('afterend', logoutBtn);
    } else {
      authLink.textContent = 'Войти';
      authLink.href = '/login.html';
    }

    updateProfileNavLink();
  }

  /* Ссылка «Мои заказы» в навигации — только для авторизованных (не админов) */
  function updateProfileNavLink() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    let link = nav.querySelector('[data-profile-link]');
    const token = localStorage.getItem('token');
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { user = null; }

    if (token && user && user.role !== 'admin') {
      if (!link) {
        link = document.createElement('a');
        link.href = '/profile.html';
        link.setAttribute('data-profile-link', '');
        link.textContent = 'Мои заказы';
        const first = nav.querySelector('a');
        if (first) first.insertAdjacentElement('afterend', link);
        else nav.appendChild(link);
      }
      if (location.pathname === '/profile.html') {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    } else if (link) {
      link.remove();
    }
  }

  updateAuthLink();
  window.addEventListener('auth:logout', updateAuthLink);
  window.addEventListener('auth:login', updateAuthLink);

  /* ---------- 5. Тосты ---------- */
  window.showToast = function (message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('toast--visible'), 2200);
  };
})();