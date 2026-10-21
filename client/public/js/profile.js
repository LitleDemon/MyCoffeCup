/**
 * profile.js — «Мои заказы».
 * Список заказов пользователя. Кнопки: «Повторить» (для paid/done),
 * «Показать чек» (для paid/done), «Отменить» (для new).
 */

(function () {
  function fmtPrice(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const STATUS_LABEL = {
    new: 'Новый',
    paid: 'Оплачен',
    done: 'Выполнен',
    cancelled: 'Отменён',
  };
  const STATUS_CLASS = {
    new: 'badge--warning',
    paid: 'badge--accent',
    done: 'badge--success',
    cancelled: 'badge--error',
  };

  function renderOrder(order) {
    const items = order.items || [];
    const itemsPreview = items.slice(0, 3).map((it) => {
      const opts = it.options || {};
      const parts = [it.name];
      if (opts.iced) parts.push('🧊');
      if (opts.size) parts.push(opts.size);
      if (Array.isArray(opts.toppings) && opts.toppings.length) {
        parts.push('+' + opts.toppings.map((t) => t.name).join(', +'));
      }
      return `<li>${escapeHtml(parts.join(' · '))} × ${it.qty}</li>`;
    }).join('');
    const more = items.length > 3 ? `<li class="text-muted">… и ещё ${items.length - 3}</li>` : '';

    const canRepeat = order.status === 'paid' || order.status === 'done';
    const canReceipt = order.status === 'paid' || order.status === 'done';

    return `
      <article class="order-card" data-order-id="${order.id}">
        <header class="order-card__header">
          <div>
            <strong>Заказ #${order.id}</strong>
            <span class="text-muted" style="margin-left: var(--sp-2); font-size: var(--fs-sm);">
              ${new Date(order.created_at).toLocaleString('ru-RU')}
            </span>
          </div>
          <span class="badge ${STATUS_CLASS[order.status] || 'badge--new'}">
            ${STATUS_LABEL[order.status] || order.status}
          </span>
        </header>

        <ul class="order-card__items">${itemsPreview}${more}</ul>

        <footer class="order-card__footer">
          <strong class="price">${fmtPrice(order.total)}</strong>
          <div class="row" style="gap: var(--sp-2);">
            ${canReceipt ? `<a href="/receipt.html?id=${order.id}" class="btn btn--secondary">Чек</a>` : ''}
            ${canRepeat ? `<button type="button" class="btn btn--primary" data-repeat="${order.id}">Повторить</button>` : ''}
          </div>
        </footer>
      </article>
    `;
  }

  async function loadOrders() {
    try {
      const data = await window.api.get('/orders/mine');
      return Array.isArray(data) ? data : (data.orders || []);
    } catch (err) {
      if (err.status === 401) {
        location.href = '/login.html?next=/profile.html';
      }
      return [];
    }
  }

  async function repeatOrder(orderId, allOrders) {
    const order = allOrders.find((o) => String(o.id) === String(orderId));
    if (!order) return;

    // Загружаем актуальные продукты, чтобы у позиций были sizes/price/name
    let products = [];
    try {
      const data = await window.api.get('/products');
      products = Array.isArray(data) ? data : (data.products || []);
    } catch {
      window.showToast?.('Не удалось загрузить товары');
      return;
    }
    const byId = new Map(products.map((p) => [String(p.id), p]));

    let added = 0;
    let skipped = 0;

    for (const it of order.items || []) {
      const product = byId.get(String(it.product_id));
      if (!product) { skipped++; continue; }

      const opts = it.options || {};
      const size = opts.size || null;
      const toppings = Array.isArray(opts.toppings) ? opts.toppings : [];
      window.Cart.add(product, { size, toppings }, it.qty);
      added++;
    }

    if (added) {
      window.showToast?.(`Добавлено в корзину: ${added}${skipped ? `, пропущено: ${skipped}` : ''}`);
      setTimeout(() => (location.href = '/cart.html'), 700);
    } else {
      window.showToast?.('Не удалось повторить заказ — товары недоступны');
    }
  }

  async function init() {
    const container = document.querySelector('[data-profile-orders]');
    if (!container) return;

    const user = window.api.getUser();
    const hint = document.querySelector('[data-profile-hint]');
    if (hint && user) hint.textContent = `Вы вошли как ${user.name || user.email}`;

    const orders = await loadOrders();
    if (!orders.length) {
      container.innerHTML = `
        <p class="text-muted">У вас пока нет заказов.</p>
        <a href="/" class="btn btn--primary">Перейти в каталог</a>
      `;
      return;
    }

    container.innerHTML = orders.map(renderOrder).join('');

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-repeat]');
      if (btn) repeatOrder(btn.getAttribute('data-repeat'), orders);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();