/**
 * checkout.js — страница оформления заказа.
 * Показывает состав корзины, выбор оплаты, отправляет заказ.
 * После успеха — редирект на /receipt.html?id=N.
 */

(function () {
  function formatPrice(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function render() {
    const items = window.Cart.get();
    const container = document.querySelector('[data-checkout-items]');
    const countEl = document.querySelector('[data-checkout-count]');
    const totalEl = document.querySelector('[data-checkout-total]');
    const submitBtn = document.querySelector('[data-submit-order]');

    if (!items.length) {
      container.innerHTML = '<p class="text-muted">Корзина пуста. <a href="/">Перейти в каталог</a></p>';
      countEl.textContent = '0';
      totalEl.textContent = formatPrice(0);
      submitBtn.disabled = true;
      return;
    }

    container.innerHTML = items.map((item) => {
      const variant = [];
      if (item.size) variant.push(`Размер ${item.size}`);
      if (Array.isArray(item.toppings) && item.toppings.length) {
        variant.push(item.toppings.map((t) => t.name).join(', '));
      }
      return `
        <div class="checkout-item">
          <img class="checkout-item__img" src="${item.image_url || ''}" alt="${escapeHtml(item.name)}">
          <div class="checkout-item__info">
            <strong>${escapeHtml(item.name)}</strong>
            ${variant.length ? `<div class="text-muted" style="font-size: var(--fs-xs);">${escapeHtml(variant.join(' · '))}</div>` : ''}
            <div class="text-muted" style="font-size: var(--fs-xs);">${item.qty} × ${formatPrice(item.price)}</div>
          </div>
          <strong>${formatPrice(item.price * item.qty)}</strong>
        </div>
      `;
    }).join('');

    const totals = window.Cart.getTotal();
    countEl.textContent = totals.count;
    totalEl.textContent = formatPrice(totals.sum);
    submitBtn.disabled = false;
  }

  async function submitOrder() {
    const items = window.Cart.get();
    if (!items.length) {
      window.showToast?.('Корзина пуста');
      return;
    }

    const submitBtn = document.querySelector('[data-submit-order]');
    submitBtn.disabled = true;

    const paymentInput = document.querySelector('input[name="payment_method"]:checked');
    const paymentMethod = paymentInput ? paymentInput.value : 'onsite';
    const stickers = window.getOrderStickers?.() || [];

    const order = {
      items: items.map((i) => ({
        product_id: i.product_id,
        qty: i.qty,
        size_code: i.size || null,
        topping_ids: (i.toppings || []).map((t) => t.id),
        iced: Boolean(i.iced),   
      })),
      stickers,
      payment_method: paymentMethod,
    };

    try {
      const created = await window.api.post('/orders', order);
      window.Cart.clear();
      window.clearOrderStickers?.();
      window.showToast?.(`Заказ #${created.id} оформлен`);
      setTimeout(() => (location.href = `/receipt.html?id=${created.id}`), 500);
    } catch (err) {
      if (err.isNetworkError) {
        localStorage.setItem('last_order', JSON.stringify({
          ...order,
          id: 'local-' + Date.now(),
          total: window.Cart.getTotal().sum,
          created_at: new Date().toISOString(),
        }));
        window.Cart.clear();
        window.clearOrderStickers?.();
        window.showToast?.('Заказ сохранён локально (нет связи с сервером)');
        setTimeout(() => (location.href = '/'), 1200);
      } else {
        window.showToast?.(err.message || 'Не удалось оформить заказ');
        submitBtn.disabled = false;
      }
    }
  }

  function init() {
    if (!document.querySelector('[data-checkout-items]')) return;
    render();
    document.querySelector('[data-submit-order]')?.addEventListener('click', submitOrder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();