/**
 * receipt.js — красивый чек по order_id из URL.
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
  const PAYMENT_LABEL = {
    online: 'Онлайн картой',
    onsite: 'На месте',
  };

  async function loadOrder(id) {
    try {
      return await window.api.get(`/orders/${id}`);
    } catch (err) {
      return { error: err.message };
    }
  }

  function renderReceipt(order) {
    const date = new Date(order.created_at).toLocaleString('ru-RU');
    const itemsHtml = (order.items || []).map((it) => {
      const opts = it.options || {};
      const variant = [];
      if (opts.iced) variant.push('🧊 Холодный');
      if (opts.size) variant.push(`Размер ${opts.size}`);
      if (Array.isArray(opts.toppings) && opts.toppings.length) {
        variant.push(opts.toppings.map((t) => t.name).join(', '));
      }
      return `
        <tr class="receipt-item">
          <td>
            <div class="receipt-item__name">${escapeHtml(it.name)}</div>
            ${variant.length ? `<div class="receipt-item__variant">${escapeHtml(variant.join(' · '))}</div>` : ''}
          </td>
          <td class="receipt-item__qty">${it.qty} × ${fmtPrice(it.price)}</td>
          <td class="receipt-item__sum">${fmtPrice(it.price * it.qty)}</td>
        </tr>
      `;
    }).join('');

    const hasStickers = Array.isArray(order.stickers) && order.stickers.length > 0;

    return `
      <div class="receipt">
        <div class="receipt__header">
          <div class="receipt__brand">MyCoffeCup</div>
          <div class="receipt__address">Новосибирск, ул. Красный Проспект 38</div>
          <div class="receipt__meta">Чек №${order.id} · ${date}</div>
        </div>

        <div class="receipt__status-row">
          <span class="badge badge--new">${STATUS_LABEL[order.status] || order.status}</span>
          <span class="badge badge--accent">${PAYMENT_LABEL[order.payment_method] || order.payment_method}</span>
          ${hasStickers ? '<span class="badge badge--success">с открыткой</span>' : ''}
        </div>

        <table class="receipt__table">
          <thead>
            <tr>
              <th>Наименование</th>
              <th style="text-align: right;">Кол-во</th>
              <th style="text-align: right;">Сумма</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div class="receipt__total">
          <span>Итого</span>
          <strong>${fmtPrice(order.total)}</strong>
        </div>

        <div class="receipt__footer">
          <p>Клиент: ${escapeHtml(order.customer_name || 'Гость')}</p>
          ${order.customer_email ? `<p>${escapeHtml(order.customer_email)}</p>` : ''}
          <p class="text-muted" style="font-size: var(--fs-xs); margin-top: var(--sp-2);">
            Спасибо за заказ! Хорошего дня ☕
          </p>
        </div>

        <div class="receipt__actions no-print">
          <a href="/profile.html" class="btn btn--secondary">← Мои заказы</a>
          <button type="button" class="btn btn--primary" onclick="window.print()">🖨 Распечатать</button>
        </div>
      </div>
    `;
  }

  async function init() {
    const container = document.querySelector('[data-receipt]');
    if (!container) return;

    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
      container.innerHTML = '<p class="text-muted">Заказ не указан. <a href="/">На главную</a></p>';
      return;
    }

    if (String(id).startsWith('local-')) {
      const local = localStorage.getItem('last_order');
      if (!local) {
        container.innerHTML = '<p class="text-muted">Заказ не найден. <a href="/">На главную</a></p>';
        return;
      }
      const order = JSON.parse(local);
      order.items = (order.items || []).map((it) => ({
        ...it,
        name: it.name || 'Товар',
        price: it.price || 0,
      }));
      container.innerHTML = renderReceipt(order);
      return;
    }

    const order = await loadOrder(id);
    if (order.error) {
      container.innerHTML = `<p class="text-muted">${escapeHtml(order.error)}. <a href="/">На главную</a></p>`;
      return;
    }

    document.title = `Чек #${order.id} — MyCoffeCup`;
    container.innerHTML = renderReceipt(order);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();