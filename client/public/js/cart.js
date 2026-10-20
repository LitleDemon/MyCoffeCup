/**
 * cart.js — корзина на localStorage.
 * Экспортирует window.Cart: { get, add, remove, updateQty, clear, getTotal }.
 * На cart.html рендерит содержимое с контролом количества [−] [N] [+],
 * удаляет товар при уходе количества в 0.
 *
 * Оформление заказа: POST /api/orders.
 * При сетевой ошибке — fallback в localStorage (last_order).
 * При HTTP-ошибке от сервера — показываем сообщение, корзину НЕ трогаем.
 */

(function () {
  const CART_KEY = 'cart';

  /* ---------- Хранилище ---------- */
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('cart:updated'));
  }

  /* ---------- Операции ---------- */
  function add(product, qty = 1) {
    const items = getCart();
    const existing = items.find((i) => String(i.id) === String(product.id));
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        image_url: product.image_url,
        qty,
      });
    }
    saveCart(items);
    return items;
  }

  function remove(id) {
    const items = getCart().filter((i) => String(i.id) !== String(id));
    saveCart(items);
    return items;
  }

  function updateQty(id, qty) {
    qty = parseInt(qty, 10);
    if (isNaN(qty) || qty <= 0) return remove(id);

    const items = getCart();
    const item = items.find((i) => String(i.id) === String(id));
    if (item) item.qty = qty;
    saveCart(items);
    return items;
  }

  function clear() {
    saveCart([]);
  }

  function getTotal() {
    const items = getCart();
    return {
      count: items.reduce((s, i) => s + i.qty, 0),
      sum: items.reduce((s, i) => s + i.qty * i.price, 0),
    };
  }

  window.Cart = { get: getCart, add, remove, updateQty, clear, getTotal };

  /* ---------- Рендер cart.html ---------- */
  function formatPrice(n) {
    return Number(n).toLocaleString('ru-RU') + ' ₽';
  }

  function renderCart() {
    const container = document.querySelector('[data-cart-items]');
    if (!container) return;

    const items = getCart();
    const emptyEl = document.querySelector('[data-cart-empty]');
    const summary = document.querySelector('.cart-summary');

    if (!items.length) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      if (summary) summary.hidden = true;
    } else {
      if (emptyEl) emptyEl.hidden = true;
      if (summary) summary.hidden = false;
      container.innerHTML = items.map((item) => `
        <div class="cart-item">
          <img class="cart-item__img" src="${item.image_url || ''}" alt="${item.name}">
          <div class="cart-item__info">
            <strong>${item.name}</strong>
            <div class="text-muted" style="font-size: var(--fs-sm);">${formatPrice(item.price)}</div>
          </div>
          <div class="cart-item__actions">
            <div class="qty-control">
              <button class="qty-btn" type="button" data-cart-dec="${item.id}" aria-label="Уменьшить">−</button>
              <input class="qty-input" type="number" min="1" inputmode="numeric"
                     value="${item.qty}" data-cart-qty="${item.id}" aria-label="Количество">
              <button class="qty-btn" type="button" data-cart-inc="${item.id}" aria-label="Увеличить">+</button>
            </div>
            <strong class="cart-item__sum">${formatPrice(item.price * item.qty)}</strong>
            <button class="btn btn--ghost" data-remove="${item.id}" aria-label="Удалить">✕</button>
          </div>
        </div>
      `).join('');
    }

    const totals = getTotal();
    document.querySelectorAll('[data-cart-total-count]').forEach((el) => el.textContent = totals.count);
    document.querySelectorAll('[data-cart-total-price]').forEach((el) => el.textContent = formatPrice(totals.sum));
  }

  function bindCartEvents() {
    const container = document.querySelector('[data-cart-items]');
    if (!container) return;

    /* Кнопки − / + */
    container.addEventListener('click', (e) => {
      const decBtn = e.target.closest('[data-cart-dec]');
      if (decBtn) {
        const id = decBtn.getAttribute('data-cart-dec');
        const cur = getCart().find((i) => String(i.id) === String(id));
        if (!cur) return;
        if (cur.qty <= 1) {
          remove(id);
        } else {
          updateQty(id, cur.qty - 1);
        }
        renderCart();
        return;
      }

      const incBtn = e.target.closest('[data-cart-inc]');
      if (incBtn) {
        const id = incBtn.getAttribute('data-cart-inc');
        const cur = getCart().find((i) => String(i.id) === String(id));
        if (!cur) return;
        updateQty(id, cur.qty + 1);
        renderCart();
        return;
      }

      const removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) {
        remove(removeBtn.getAttribute('data-remove'));
        renderCart();
      }
    });

    /* Ручной ввод: обновляем сумму на лету, без перерисовки */
    container.addEventListener('input', (e) => {
      const input = e.target.closest('[data-cart-qty]');
      if (!input) return;
      const id = input.getAttribute('data-cart-qty');
      const value = parseInt(input.value, 10);
      if (isNaN(value) || value < 1) return;

      const cur = getCart().find((i) => String(i.id) === String(id));
      if (!cur || cur.qty === value) return;

      const items = getCart();
      const item = items.find((i) => String(i.id) === String(id));
      if (item) item.qty = value;
      localStorage.setItem(CART_KEY, JSON.stringify(items));
      window.dispatchEvent(new Event('cart:updated'));

      const row = input.closest('.cart-item');
      const sumEl = row?.querySelector('.cart-item__sum');
      if (sumEl) sumEl.textContent = formatPrice(item.price * value);

      const totals = getTotal();
      document.querySelectorAll('[data-cart-total-count]').forEach((el) => el.textContent = totals.count);
      document.querySelectorAll('[data-cart-total-price]').forEach((el) => el.textContent = formatPrice(totals.sum));
    });

    /* Потеря фокуса / Enter — финализируем, при 0 удаляем */
    container.addEventListener('change', (e) => {
      const input = e.target.closest('[data-cart-qty]');
      if (!input) return;
      const id = input.getAttribute('data-cart-qty');
      const raw = input.value.trim();

      if (raw === '' || parseInt(raw, 10) <= 0) {
        remove(id);
      } else {
        const value = parseInt(raw, 10);
        const cur = getCart().find((i) => String(i.id) === String(id));
        if (cur && cur.qty !== value) updateQty(id, value);
      }
      renderCart();
    });

    /* Enter в поле — снимаем фокус, чтобы сработал change */
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-cart-qty]')) {
        e.target.blur();
      }
    });

    document.querySelectorAll('[data-checkout]').forEach((btn) => {
      btn.addEventListener('click', checkout);
    });
  }

  async function checkout() {
    const items = getCart();
    if (!items.length) {
      window.showToast?.('Корзина пуста');
      return;
    }
    const stickers = window.getOrderStickers?.() || [];
    const order = {
      items: items.map((i) => ({ product_id: i.id, qty: i.qty })),
      stickers,
    };

    try {
      const created = await window.api.post('/orders', order);
      clear();
      window.clearOrderStickers?.();
      window.showToast?.(`Заказ #${created.id} оформлен!`);
      setTimeout(() => (location.href = '/'), 900);
    } catch (err) {
      if (!err.isNetworkError) {
        // Сервер вернул ошибку — показываем её, корзину не трогаем
        window.showToast?.(err.message || 'Не удалось оформить заказ');
        return;
      }

      // Сервер недоступен — fallback для проверки
      const totals = getTotal();
      console.warn('Оформление через API недоступно:', err.message);
      localStorage.setItem('last_order', JSON.stringify({
        ...order,
        total: totals.sum,
        created_at: new Date().toISOString(),
      }));
      clear();
      window.clearOrderStickers?.();
      window.showToast?.('Заказ сохранён локально (бэкенд не подключён)');
      setTimeout(() => (location.href = '/'), 1200);
    }
  }

  /* ---------- Старт ---------- */
  function init() {
    if (document.querySelector('[data-cart-items]')) {
      renderCart();
      bindCartEvents();
      window.addEventListener('storage', (e) => {
        if (e.key === CART_KEY) renderCart();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();