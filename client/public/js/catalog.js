/**
 * catalog.js — каталог и страница товара.
 * Источник данных — только API (/api/products и /api/toppings).
 *
 * На карточках — выбор размера. На странице товара — размер, температура
 * (если доступна) и топпинги.
 */

(function () {
  let allProducts = [];
  let allToppings = [];

  async function loadData() {
    try {
      const [p, t] = await Promise.all([
        window.api.get('/products'),
        window.api.get('/toppings').catch(() => ({ toppings: [] })),
      ]);
      allProducts = Array.isArray(p) ? p : (p.products || []);
      allToppings = Array.isArray(t) ? t : (t.toppings || []);
    } catch (err) {
      console.warn('Не удалось загрузить данные:', err.message);
      allProducts = [];
      allToppings = [];
    }
  }

  async function loadProduct(id) {
    try {
      const data = await window.api.get(`/products/${id}`);
      return data.product || data;
    } catch (err) {
      console.warn(`Товар #${id} не загружен:`, err.message);
      return null;
    }
  }

  function formatPrice(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }
  const CATEGORY_LABELS = { coffee: 'Кофе', tea: 'Чай', dessert: 'Десерт' };

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function isDrink(product) {
    return product.category === 'coffee' || product.category === 'tea';
  }

  function getSizes(product) {
    if (Array.isArray(product.sizes) && product.sizes.length) return product.sizes;
    return null;
  }

  function buildKey(productId, sizeCode, toppingIds = [], iced = false) {
    const t = [...toppingIds].sort((a, b) => a - b).join('-');
    return `${productId}_${sizeCode || ''}_${t}_${iced ? 'i' : 'h'}`;
  }

  function getCartQty(key) {
    const items = window.Cart?.get() || [];
    const found = items.find((i) => i.key === key);
    return found ? found.qty : 0;
  }

  /* ---------- Карточка в каталоге ---------- */

  function activeSizeOf(product) {
    const sizes = getSizes(product);
    if (!sizes) return null;
    return sizes[0].code;
  }

  function sizePrice(product, sizeCode) {
    const sizes = getSizes(product);
    if (!sizes) return Number(product.price);
    const found = sizes.find((s) => s.code === sizeCode);
    return found ? Number(found.price) : Number(product.price);
  }

  function renderSizes(product, activeSize) {
    const sizes = getSizes(product);
    if (!sizes) return '';
    return `
      <div class="size-picker" data-size-picker="${product.id}">
        ${sizes.map((s) => `
          <button type="button" class="size-chip ${s.code === activeSize ? 'size-chip--active' : ''}"
                  data-size-chip="${s.code}" data-size-price="${s.price}">
            ${s.code}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderActionsFor(product, sizeCode) {
    const key = buildKey(product.id, sizeCode, [], false);
    const qty = getCartQty(key);
    if (qty <= 0) {
      return `<button class="btn btn--primary" data-add-to-cart="${product.id}" data-add-size="${sizeCode || ''}">В корзину</button>`;
    }
    return `
      <div class="qty-control">
        <button class="qty-btn" type="button" data-qty-dec="${product.id}" data-qty-size="${sizeCode || ''}" aria-label="Уменьшить">−</button>
        <input class="qty-input" type="number" min="1" inputmode="numeric"
               value="${qty}" data-qty-input="${product.id}" data-qty-size="${sizeCode || ''}" aria-label="Количество">
        <button class="qty-btn" type="button" data-qty-inc="${product.id}" data-qty-size="${sizeCode || ''}" aria-label="Увеличить">+</button>
      </div>
    `;
  }

  function renderCard(p) {
    const size = activeSizeOf(p);
    const price = sizePrice(p, size);
    return `
      <article class="product-card" data-product-card="${p.id}" data-active-size="${size || ''}">
        <a class="product-card__media" href="/product.html?id=${p.id}">
          <img src="${p.image_url || ''}" alt="${escapeHtml(p.name)}" loading="lazy">
          ${p.is_seasonal ? '<span class="badge badge--accent product-card__season">Сезон</span>' : ''}
          ${p.has_iced_option ? '<span class="badge product-card__iced" title="Можно охлаждённым">🧊 Холодный</span>' : ''}
        </a>
        <div class="product-card__body">
          <h3 class="product-card__title">
            <a href="/product.html?id=${p.id}" style="color: inherit;">${escapeHtml(p.name)}</a>
          </h3>
          <p class="product-card__desc">${escapeHtml(p.description || '')}</p>
          ${renderSizes(p, size)}
          <div class="product-card__footer">
            <span class="price" data-card-price>${formatPrice(price)}</span>
            <div class="product-card__actions" data-actions="${p.id}">
              ${renderActionsFor(p, size)}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function bindCardActions(grid) {
    grid.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-size-chip]');
      if (chip) {
        e.preventDefault();
        const picker = chip.closest('[data-size-picker]');
        const card = chip.closest('[data-product-card]');
        const productId = picker.getAttribute('data-size-picker');
        const sizeCode = chip.getAttribute('data-size-chip');
        const price = Number(chip.getAttribute('data-size-price'));

        picker.querySelectorAll('[data-size-chip]').forEach((c) => {
          c.classList.toggle('size-chip--active', c === chip);
        });

        card.setAttribute('data-active-size', sizeCode);
        card.querySelector('[data-card-price]').textContent = formatPrice(price);

        const product = allProducts.find((p) => String(p.id) === String(productId));
        const actionsEl = card.querySelector('[data-actions]');
        if (product && actionsEl) actionsEl.innerHTML = renderActionsFor(product, sizeCode);
        return;
      }

      const addBtn = e.target.closest('[data-add-to-cart]');
      if (addBtn) {
        const id = addBtn.getAttribute('data-add-to-cart');
        const size = addBtn.getAttribute('data-add-size') || null;
        const product = allProducts.find((p) => String(p.id) === String(id));
        if (!product) return;
        window.Cart.add(product, { size, toppings: [], iced: false }, 1);
        forceRenderActions(id, size);
        window.showToast?.(`«${product.name}» добавлен`);
        return;
      }

      const decBtn = e.target.closest('[data-qty-dec]');
      if (decBtn) {
        const id = decBtn.getAttribute('data-qty-dec');
        const size = decBtn.getAttribute('data-qty-size') || null;
        const key = buildKey(id, size, [], false);
        const cur = getCartQty(key);
        if (cur <= 1) window.Cart.remove(key);
        else window.Cart.updateQty(key, cur - 1);
        forceRenderActions(id, size);
        return;
      }

      const incBtn = e.target.closest('[data-qty-inc]');
      if (incBtn) {
        const id = incBtn.getAttribute('data-qty-inc');
        const size = incBtn.getAttribute('data-qty-size') || null;
        const product = allProducts.find((p) => String(p.id) === String(id));
        if (!product) return;
        const key = buildKey(id, size, [], false);
        const cur = getCartQty(key);
        if (cur === 0) window.Cart.add(product, { size, toppings: [], iced: false }, 1);
        else window.Cart.updateQty(key, cur + 1);
        forceRenderActions(id, size);
        return;
      }
    });

    grid.addEventListener('change', (e) => {
      const input = e.target.closest('[data-qty-input]');
      if (!input) return;
      const id = input.getAttribute('data-qty-input');
      const size = input.getAttribute('data-qty-size') || null;
      const key = buildKey(id, size, [], false);
      const raw = input.value.trim();
      const value = parseInt(raw, 10);
      if (isNaN(value) || value <= 0) window.Cart.remove(key);
      else window.Cart.updateQty(key, value);
      forceRenderActions(id, size);
    });
  }

  function forceRenderActions(productId, sizeCode) {
    const card = document.querySelector(`[data-product-card="${productId}"]`);
    if (!card) return;
    const product = allProducts.find((p) => String(p.id) === String(productId));
    if (!product) return;
    const el = card.querySelector('[data-actions]');
    if (el) el.innerHTML = renderActionsFor(product, sizeCode);
  }

  function bindCartUpdates() {
    window.addEventListener('cart:updated', () => {
      document.querySelectorAll('[data-product-card]').forEach((card) => {
        const id = card.getAttribute('data-product-card');
        const size = card.getAttribute('data-active-size') || null;
        forceRenderActions(id, size);
      });
    });
  }

  async function initCatalog() {
    const grid = document.querySelector('[data-products]');
    if (!grid) return;

    grid.innerHTML = '<p class="text-muted">Загрузка товаров…</p>';
    await loadData();

    function applyFilters() {
      const search = (document.querySelector('[data-search]')?.value || '').trim().toLowerCase();
      const category = document.querySelector('[data-category-filter]')?.value || '';
      const seasonalOnly = document.querySelector('[data-seasonal-filter]')?.checked || false;

      const filtered = allProducts.filter((p) => {
        const name = String(p.name || '').toLowerCase();
        if (search && !name.includes(search)) return false;
        if (category && p.category !== category) return false;
        if (seasonalOnly && !p.is_seasonal) return false;
        return true;
      });

      filtered.sort((a, b) => {
        if (a.is_seasonal && !b.is_seasonal) return -1;
        if (!a.is_seasonal && b.is_seasonal) return 1;
        return 0;
      });

      if (!allProducts.length) {
        grid.innerHTML = '<p class="text-muted">В каталоге пока нет товаров.</p>';
        return;
      }
      if (!filtered.length) {
        grid.innerHTML = '<p class="text-muted">Ничего не найдено. Попробуйте изменить фильтры.</p>';
        return;
      }
      grid.innerHTML = filtered.map(renderCard).join('');
    }

    document.querySelector('[data-search]')?.addEventListener('input', applyFilters);
    document.querySelector('[data-category-filter]')?.addEventListener('change', applyFilters);
    document.querySelector('[data-seasonal-filter]')?.addEventListener('change', applyFilters);

    bindCardActions(grid);
    bindCartUpdates();
    applyFilters();
  }

  /* ---------- Страница товара ---------- */

  async function initProductPage() {
    const container = document.querySelector('[data-product]');
    if (!container) return;

    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
      container.innerHTML = '<p class="text-muted">Товар не найден. <a href="/">Вернуться в каталог</a></p>';
      return;
    }

    container.innerHTML = '<p class="text-muted">Загрузка…</p>';

    if (!allToppings.length) {
      try {
        const t = await window.api.get('/toppings').catch(() => ({ toppings: [] }));
        allToppings = Array.isArray(t) ? t : (t.toppings || []);
      } catch { /* уже пусто */ }
    }

    const p = await loadProduct(id);
    if (!p) {
      container.innerHTML = '<p class="text-muted">Товар не найден. <a href="/">Вернуться в каталог</a></p>';
      return;
    }
    if (!allProducts.find((x) => String(x.id) === String(p.id))) allProducts.push(p);

    document.title = `${p.name} — MyCoffeCup`;

    const sizes = getSizes(p);
    const isDrinkProduct = isDrink(p);
    const initialSize = sizes ? sizes[0].code : null;
    const initialPrice = sizePrice(p, initialSize);

    container.innerHTML = `
      <div class="product-detail">
        <div class="product-detail__media">
          <img src="${p.image_url || ''}" alt="${escapeHtml(p.name)}">
          ${p.is_seasonal ? '<span class="badge badge--accent product-detail__season">Сезон</span>' : ''}
        </div>
        <div class="product-detail__content">
          <span class="badge badge--accent">${CATEGORY_LABELS[p.category] || p.category}</span>
          <h1 style="margin-top: var(--sp-2);">${escapeHtml(p.name)}</h1>
          <p class="text-muted">${escapeHtml(p.description || '')}</p>

          ${sizes ? `
            <div class="field" style="margin-top: var(--sp-4);">
              <span class="field__label">Размер</span>
              <div class="size-picker size-picker--lg" data-detail-sizes>
                ${sizes.map((s) => `
                  <button type="button" class="size-chip ${s.code === initialSize ? 'size-chip--active' : ''}"
                          data-detail-size="${s.code}" data-detail-price="${s.price}">
                    ${s.code} · ${formatPrice(s.price)}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${p.has_iced_option ? `
            <div class="field" style="margin-top: var(--sp-4);">
              <span class="field__label">Температура</span>
              <div class="iced-picker" data-iced-picker>
                <button type="button" class="size-chip size-chip--active" data-iced="false">☕ Горячий</button>
                <button type="button" class="size-chip" data-iced="true">🧊 Холодный</button>
              </div>
            </div>
          ` : ''}

          ${isDrinkProduct && allToppings.length ? `
            <div class="field" style="margin-top: var(--sp-4);">
              <span class="field__label">Добавки</span>
              <div class="topping-list" data-detail-toppings>
                ${allToppings.map((t) => `
                  <label class="topping-item">
                    <input type="checkbox" value="${t.id}"
                           data-topping-check="${t.id}"
                           data-topping-price="${t.price}"
                           data-topping-name="${escapeHtml(t.name)}">
                    <span class="topping-item__name">
                      ${escapeHtml(t.name)}
                      ${t.is_seasonal ? '<span class="badge badge--accent topping-item__season">сезон</span>' : ''}
                    </span>
                    <span class="topping-item__price">+${formatPrice(t.price)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="product-detail__total">
            <span class="text-muted">Итого:</span>
            <strong class="price" data-detail-total>${formatPrice(initialPrice)}</strong>
          </div>

          <div class="row" style="margin-top: var(--sp-3);">
            <div data-detail-actions></div>
          </div>

          <p style="margin-top: var(--sp-4);">
            <a href="/">← Вернуться в каталог</a>
          </p>
        </div>
      </div>
    `;

    const state = {
      product: p,
      size: initialSize,
      sizePrice: initialPrice,
      toppings: [],
      iced: false,
    };

    function calcTotal() {
      return state.sizePrice + state.toppings.reduce((s, t) => s + t.price, 0);
    }

    function currentKey() {
      return buildKey(p.id, state.size, state.toppings.map((t) => t.id), state.iced);
    }

    function updateTotalAndActions() {
      const total = calcTotal();
      const totalEl = container.querySelector('[data-detail-total]');
      if (totalEl) totalEl.textContent = formatPrice(total);

      const actionsEl = container.querySelector('[data-detail-actions]');
      if (!actionsEl) return;

      const qty = getCartQty(currentKey());
      if (qty === 0) {
        actionsEl.innerHTML = `<button class="btn btn--primary" data-detail-add>В корзину</button>`;
      } else {
        actionsEl.innerHTML = `
          <div class="qty-control">
            <button class="qty-btn" type="button" data-detail-dec>−</button>
            <input class="qty-input" type="number" min="1" value="${qty}" data-detail-qty>
            <button class="qty-btn" type="button" data-detail-inc>+</button>
          </div>
        `;
      }
    }

    container.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-detail-size]');
      if (chip) {
        const code = chip.getAttribute('data-detail-size');
        const price = Number(chip.getAttribute('data-detail-price'));
        state.size = code;
        state.sizePrice = price;
        container.querySelectorAll('[data-detail-size]').forEach((c) =>
          c.classList.toggle('size-chip--active', c === chip));
        updateTotalAndActions();
        return;
      }

      const icedBtn = e.target.closest('[data-iced]');
      if (icedBtn) {
        state.iced = icedBtn.getAttribute('data-iced') === 'true';
        container.querySelectorAll('[data-iced]').forEach((b) =>
          b.classList.toggle('size-chip--active', b === icedBtn));
        updateTotalAndActions();
        return;
      }

      if (e.target.closest('[data-detail-add]')) {
        window.Cart.add(p, {
          size: state.size,
          toppings: state.toppings,
          iced: state.iced,
        }, 1);
        window.showToast?.(`«${p.name}» добавлен`);
        updateTotalAndActions();
        return;
      }

      if (e.target.closest('[data-detail-inc]')) {
        window.Cart.updateQty(currentKey(), getCartQty(currentKey()) + 1);
        updateTotalAndActions();
        return;
      }
      if (e.target.closest('[data-detail-dec]')) {
        const q = getCartQty(currentKey());
        if (q <= 1) window.Cart.remove(currentKey());
        else window.Cart.updateQty(currentKey(), q - 1);
        updateTotalAndActions();
        return;
      }
    });

    container.querySelectorAll('[data-topping-check]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const tid = Number(chk.getAttribute('data-topping-check'));
        const tprice = Number(chk.getAttribute('data-topping-price'));
        const tname = chk.getAttribute('data-topping-name');
        if (chk.checked) state.toppings.push({ id: tid, name: tname, price: tprice });
        else state.toppings = state.toppings.filter((t) => t.id !== tid);
        updateTotalAndActions();
      });
    });

    container.addEventListener('change', (e) => {
      const input = e.target.closest('[data-detail-qty]');
      if (!input) return;
      const v = parseInt(input.value, 10);
      if (isNaN(v) || v <= 0) window.Cart.remove(currentKey());
      else window.Cart.updateQty(currentKey(), v);
      updateTotalAndActions();
    });

    updateTotalAndActions();
  }

  function init() {
    initCatalog();
    initProductPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();