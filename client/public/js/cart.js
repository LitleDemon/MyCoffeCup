/**
 * cart.js — корзина на localStorage.
 *
 * Позиция = product_id + размер + набор топпингов (ключ).
 * Экспорт: window.Cart = { get, add, remove, updateQty, updateItem, clear, getTotal }.
 *
 * Оформление: POST /api/orders с items[{product_id, qty, size_code, topping_ids}].
 */

(function () {
  const CART_KEY = 'cart';
  let cachedToppings = null;

  /* ---------- Storage ---------- */
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
  }

  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('cart:updated'));
  }

  /* ---------- Helpers ---------- */
  function buildKey(productId, sizeCode, toppingIds) {
    const t = (toppingIds || []).map(Number).sort((a, b) => a - b).join('-');
    return `${productId}_${sizeCode || ''}_${t}`;
  }

  function calcUnitPrice(product, sizeCode, toppings) {
    let base = Number(product.price);
    if (Array.isArray(product.sizes) && product.sizes.length && sizeCode) {
      const found = product.sizes.find((s) => s.code === sizeCode);
      if (found) base = Number(found.price);
    }
    return base + (toppings || []).reduce((s, t) => s + Number(t.price || 0), 0);
  }

  function calcPriceFromItem(item, sizeCode, toppings) {
    let base = Number(item.basePrice || item.price);
    if (Array.isArray(item.product_sizes) && item.product_sizes.length) {
      const found = item.product_sizes.find((s) => s.code === sizeCode);
      base = found ? Number(found.price) : Number(item.product_sizes[0].price);
    }
    return base + (toppings || []).reduce((s, t) => s + Number(t.price || 0), 0);
  }

  function basePriceFromItem(item, sizeCode) {
    if (Array.isArray(item.product_sizes) && item.product_sizes.length) {
      const found = item.product_sizes.find((s) => s.code === sizeCode);
      return found ? Number(found.price) : Number(item.product_sizes[0].price);
    }
    return Number(item.basePrice || item.price);
  }

  /* ---------- Операции ---------- */
  function add(product, optionsOrQty = {}, maybeQty = 1) {
    let opts, qty;
    if (typeof optionsOrQty === 'number') { opts = { size: null, toppings: [] }; qty = optionsOrQty; }
    else { opts = optionsOrQty || { size: null, toppings: [] }; qty = maybeQty; }

    const size = opts.size || null;
    const toppings = opts.toppings || [];
    const toppingIds = toppings.map((t) => Number(t.id)).sort((a, b) => a - b);
    const key = buildKey(product.id, size, toppingIds);
    const unitPrice = calcUnitPrice(product, size, toppings);

    const items = getCart();
    const existing = items.find((i) => i.key === key);
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({
        key,
        product_id: product.id,
        name: product.name,
        image_url: product.image_url,
        product_sizes: Array.isArray(product.sizes) ? product.sizes : null,
        basePrice: basePriceFromItem({ product_sizes: product.sizes, basePrice: product.price }, size),
        size,
        toppings,
        price: unitPrice,
        qty,
      });
    }
    saveCart(items);
    return items;
  }

  function remove(key) {
    const items = getCart().filter((i) => i.key !== key);
    saveCart(items);
    return items;
  }

  function updateQty(key, qty) {
    qty = parseInt(qty, 10);
    if (isNaN(qty) || qty <= 0) return remove(key);
    const items = getCart();
    const item = items.find((i) => i.key === key);
    if (item) item.qty = qty;
    saveCart(items);
    return items;
  }

  function updateItem(oldKey, newSize, newToppings) {
    const items = getCart();
    const idx = items.findIndex((i) => i.key === oldKey);
    if (idx === -1) return items;
    const item = items[idx];
    const oldQty = item.qty;

    const newToppingIds = (newToppings || []).map((t) => Number(t.id)).sort((a, b) => a - b);
    const newKey = buildKey(item.product_id, newSize, newToppingIds);
    const newPrice = calcPriceFromItem(item, newSize, newToppings);
    const newBase = basePriceFromItem(item, newSize);

    if (newKey === oldKey) {
      item.size = newSize;
      item.toppings = newToppings;
      item.price = newPrice;
      item.basePrice = newBase;
    } else {
      items.splice(idx, 1);
      const existing = items.find((i) => i.key === newKey);
      if (existing) {
        existing.qty += oldQty;
      } else {
        items.push({
          ...item,
          key: newKey,
          size: newSize,
          toppings: newToppings,
          price: newPrice,
          basePrice: newBase,
          qty: oldQty,
        });
      }
    }
    saveCart(items);
    return items;
  }

  function clear() { saveCart([]); }

  function getTotal() {
    const items = getCart();
    return {
      count: items.reduce((s, i) => s + i.qty, 0),
      sum: items.reduce((s, i) => s + i.qty * i.price, 0),
    };
  }

  window.Cart = { get: getCart, add, remove, updateQty, updateItem, clear, getTotal };

  /* ---------- Render ---------- */
  function formatPrice(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderItem(item) {
    const variant = [];
    if (item.size) variant.push(`Размер ${item.size}`);
    if (Array.isArray(item.toppings) && item.toppings.length) {
      variant.push(item.toppings.map((t) => t.name).join(', '));
    }
    return `
      <div class="cart-item" data-key="${item.key}">
        <img class="cart-item__img" src="${item.image_url || ''}" alt="${escapeHtml(item.name)}">
        <div class="cart-item__info">
          <strong>${escapeHtml(item.name)}</strong>
          ${variant.length ? `<div class="cart-item__variant text-muted">${escapeHtml(variant.join(' · '))}</div>` : ''}
          <div class="cart-item__price-unit text-muted">${formatPrice(item.price)} / шт</div>
        </div>
        <div class="cart-item__actions">
          <div class="qty-control">
            <button class="qty-btn" type="button" data-cart-dec="${item.key}" aria-label="Уменьшить">−</button>
            <input class="qty-input" type="number" min="1" value="${item.qty}" data-cart-qty="${item.key}" aria-label="Количество">
            <button class="qty-btn" type="button" data-cart-inc="${item.key}" aria-label="Увеличить">+</button>
          </div>
          <strong class="cart-item__sum">${formatPrice(item.price * item.qty)}</strong>
          <button class="btn btn--ghost" data-edit-item="${item.key}" title="Изменить">✎</button>
          <button class="btn btn--ghost" data-remove="${item.key}" title="Удалить">✕</button>
        </div>
      </div>
    `;
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
      container.innerHTML = items.map(renderItem).join('');
    }

    const totals = getTotal();
    document.querySelectorAll('[data-cart-total-count]').forEach((el) => el.textContent = totals.count);
    document.querySelectorAll('[data-cart-total-price]').forEach((el) => el.textContent = formatPrice(totals.sum));
  }

  /* ---------- События ---------- */
  function bindCartEvents() {
    const container = document.querySelector('[data-cart-items]');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const decBtn = e.target.closest('[data-cart-dec]');
      if (decBtn) {
        const key = decBtn.getAttribute('data-cart-dec');
        const item = getCart().find((i) => i.key === key);
        if (!item) return;
        if (item.qty <= 1) remove(key);
        else updateQty(key, item.qty - 1);
        renderCart();
        return;
      }

      const incBtn = e.target.closest('[data-cart-inc]');
      if (incBtn) {
        const key = incBtn.getAttribute('data-cart-inc');
        const item = getCart().find((i) => i.key === key);
        if (!item) return;
        updateQty(key, item.qty + 1);
        renderCart();
        return;
      }

      const removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) {
        remove(removeBtn.getAttribute('data-remove'));
        renderCart();
        return;
      }

      const editBtn = e.target.closest('[data-edit-item]');
      if (editBtn) {
        openEditor(editBtn.getAttribute('data-edit-item'));
        return;
      }
    });

    /* Ручной ввод qty — мгновенный пересчёт без перерисовки */
    container.addEventListener('input', (e) => {
      const input = e.target.closest('[data-cart-qty]');
      if (!input) return;
      const key = input.getAttribute('data-cart-qty');
      const value = parseInt(input.value, 10);
      if (isNaN(value) || value < 1) return;

      const items = getCart();
      const item = items.find((i) => i.key === key);
      if (!item || item.qty === value) return;

      item.qty = value;
      localStorage.setItem(CART_KEY, JSON.stringify(items));
      window.dispatchEvent(new Event('cart:updated'));

      const row = input.closest('.cart-item');
      const sumEl = row?.querySelector('.cart-item__sum');
      if (sumEl) sumEl.textContent = formatPrice(item.price * value);

      const totals = getTotal();
      document.querySelectorAll('[data-cart-total-count]').forEach((el) => el.textContent = totals.count);
      document.querySelectorAll('[data-cart-total-price]').forEach((el) => el.textContent = formatPrice(totals.sum));
    });

    container.addEventListener('change', (e) => {
      const input = e.target.closest('[data-cart-qty]');
      if (!input) return;
      const key = input.getAttribute('data-cart-qty');
      const raw = input.value.trim();
      if (raw === '' || parseInt(raw, 10) <= 0) remove(key);
      else {
        const value = parseInt(raw, 10);
        const item = getCart().find((i) => i.key === key);
        if (item && item.qty !== value) updateQty(key, value);
      }
      renderCart();
    });

    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-cart-qty]')) e.target.blur();
    });

    document.querySelectorAll('[data-checkout]').forEach((btn) => {
      btn.addEventListener('click', checkout);
    });
  }

  /* ---------- Редактор позиции ---------- */
  async function loadToppings() {
    if (cachedToppings) return cachedToppings;
    try {
      const data = await window.api.get('/toppings');
      cachedToppings = Array.isArray(data) ? data : (data.toppings || []);
    } catch { cachedToppings = []; }
    return cachedToppings;
  }

  async function openEditor(key) {
    const items = getCart();
    const item = items.find((i) => i.key === key);
    if (!item) return;

    const modal = document.querySelector('[data-edit-modal]');
    if (!modal) return;

    const toppings = await loadToppings();

    const form = modal.querySelector('[data-edit-form]');
    const sizesField = modal.querySelector('[data-edit-sizes-field]');
    const toppingsField = modal.querySelector('[data-edit-toppings-field]');
    const priceEl = modal.querySelector('[data-edit-price]');
    const titleEl = modal.querySelector('[data-edit-modal-title]');

    titleEl.textContent = `Изменить: ${item.name}`;

    let currentSize = item.size;
    let currentToppings = Array.isArray(item.toppings) ? [...item.toppings] : [];

    /* Размеры */
    if (Array.isArray(item.product_sizes) && item.product_sizes.length) {
      sizesField.hidden = false;
      sizesField.innerHTML = `
        <span class="field__label">Размер</span>
        <div class="size-picker size-picker--lg">
          ${item.product_sizes.map((s) => `
            <button type="button" class="size-chip ${s.code === currentSize ? 'size-chip--active' : ''}"
                    data-edit-size="${s.code}" data-edit-size-price="${s.price}">
              ${s.code} · ${formatPrice(s.price)}
            </button>
          `).join('')}
        </div>
      `;
    } else {
      sizesField.hidden = true;
      sizesField.innerHTML = '';
    }

    /* Топпинги — только для напитков */
    const isDrinkItem = Array.isArray(item.product_sizes) && item.product_sizes.length > 0;
    if (isDrinkItem && toppings.length) {
      toppingsField.hidden = false;
      toppingsField.innerHTML = `
        <span class="field__label" style="display:block; margin-top: var(--sp-3);">Добавки</span>
        <div class="topping-list">
          ${toppings.map((t) => {
            const checked = currentToppings.some((ct) => Number(ct.id) === Number(t.id));
            return `
              <label class="topping-item">
                <input type="checkbox" ${checked ? 'checked' : ''}
                       data-edit-topping="${t.id}"
                       data-edit-topping-price="${t.price}"
                       data-edit-topping-name="${escapeHtml(t.name)}">
                <span class="topping-item__name">
                  ${escapeHtml(t.name)}
                  ${t.is_seasonal ? '<span class="badge badge--accent topping-item__season">сезон</span>' : ''}
                </span>
                <span class="topping-item__price">+${formatPrice(t.price)}</span>
              </label>
            `;
          }).join('')}
        </div>
      `;
    } else {
      toppingsField.hidden = true;
      toppingsField.innerHTML = '';
    }

    function recalcPrice() {
      const price = calcPriceFromItem(item, currentSize, currentToppings);
      priceEl.textContent = formatPrice(price);
    }
    recalcPrice();

    /* Обработчики размеров */
    sizesField.onclick = (e) => {
      const chip = e.target.closest('[data-edit-size]');
      if (!chip) return;
      currentSize = chip.getAttribute('data-edit-size');
      sizesField.querySelectorAll('[data-edit-size]').forEach((c) =>
        c.classList.toggle('size-chip--active', c === chip));
      recalcPrice();
    };

    /* Обработчики топпингов */
    toppingsField.querySelectorAll('[data-edit-topping]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const id = Number(chk.getAttribute('data-edit-topping'));
        const price = Number(chk.getAttribute('data-edit-topping-price'));
        const name = chk.getAttribute('data-edit-topping-name');
        if (chk.checked) currentToppings.push({ id, name, price });
        else currentToppings = currentToppings.filter((t) => Number(t.id) !== id);
        recalcPrice();
      });
    });

    /* Сохранение */
    form.onsubmit = (e) => {
      e.preventDefault();
      updateItem(key, currentSize, currentToppings);
      closeEditor();
      renderCart();
      window.showToast?.('Позиция обновлена');
    };

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeEditor() {
    const modal = document.querySelector('[data-edit-modal]');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  function bindModalClose() {
    const modal = document.querySelector('[data-edit-modal]');
    if (!modal) return;
    modal.querySelectorAll('[data-close-edit-modal]').forEach((el) => {
      el.addEventListener('click', closeEditor);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeEditor();
    });
  }

  /* ---------- Оформление ---------- */
  async function checkout() {
    const items = getCart();
    if (!items.length) {
      window.showToast?.('Корзина пуста');
      return;
    }

    const total = getTotal().sum;
    const stickers = window.getOrderStickers?.() || [];
    const order = {
      items: items.map((i) => ({
        product_id: i.product_id,
        qty: i.qty,
        size_code: i.size || null,
        topping_ids: (i.toppings || []).map((t) => t.id),
      })),
      stickers,
      payment_method: 'onsite', // временно; в Фазе 5 — выбор на странице checkout
    };

    try {
      const created = await window.api.post('/orders', order);
      clear();
      window.clearOrderStickers?.();
      window.showToast?.(`Заказ #${created.id} оформлен!`);
      setTimeout(() => (location.href = '/'), 900);
    } catch (err) {
      if (!err.isNetworkError) {
        window.showToast?.(err.message || 'Не удалось оформить заказ');
        return;
      }
      localStorage.setItem('last_order', JSON.stringify({
        ...order, total, created_at: new Date().toISOString(),
      }));
      clear();
      window.clearOrderStickers?.();
      window.showToast?.('Заказ сохранён локально');
      setTimeout(() => (location.href = '/'), 1200);
    }
  }

  /* ---------- Старт ---------- */
  function init() {
    if (document.querySelector('[data-cart-items]')) {
      renderCart();
      bindCartEvents();
      bindModalClose();
      window.addEventListener('cart:updated', renderCart);
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