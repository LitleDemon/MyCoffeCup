/**
 * catalog.js — каталог и страница товара.
 * На карточках — контрол количества, если товар уже в корзине.
 * Источник данных: API → localStorage.mock_products → MOCK_PRODUCTS.
 */

const MOCK_PRODUCTS = [
  { id: 1, name: 'Эспрессо',         category: 'coffee',  price: 150, stock: 100,
    description: 'Классический крепкий эспрессо из смеси арабики и робусты.',
    image_url: 'https://picsum.photos/seed/espresso/600/450' },
  { id: 2, name: 'Американо',        category: 'coffee',  price: 180, stock: 100,
    description: 'Эспрессо с горячей водой. Мягкий и бодрящий.',
    image_url: 'https://picsum.photos/seed/americano/600/450' },
  { id: 3, name: 'Латте',            category: 'coffee',  price: 280, stock: 80,
    description: 'Эспрессо с подогретым молоком и нежной пенкой.',
    image_url: 'https://picsum.photos/seed/latte/600/450' },
  { id: 4, name: 'Капучино',         category: 'coffee',  price: 260, stock: 80,
    description: 'Эспрессо и вспененное молоко в равных пропорциях.',
    image_url: 'https://picsum.photos/seed/cappuccino/600/450' },
  { id: 5, name: 'Матча-латте',      category: 'tea',     price: 320, stock: 50,
    description: 'Японский зелёный чай матча с молоком.',
    image_url: 'https://picsum.photos/seed/matcha/600/450' },
  { id: 6, name: 'Облепиховый чай',  category: 'tea',     price: 240, stock: 50,
    description: 'Согревающий чай с облепихой и мёдом.',
    image_url: 'https://picsum.photos/seed/teaberry/600/450' },
  { id: 7, name: 'Круассан',         category: 'dessert', price: 180, stock: 30,
    description: 'Классический французский круассан со сливочным маслом.',
    image_url: 'https://picsum.photos/seed/croissant/600/450' },
  { id: 8, name: 'Чизкейк',          category: 'dessert', price: 320, stock: 20,
    description: 'Нежный чизкейк на песочной основе с ягодным соусом.',
    image_url: 'https://picsum.photos/seed/cheesecake/600/450' },
];

(function () {
  let allProducts = [];

  function readLocalProducts() {
    try {
      const raw = localStorage.getItem('mock_products');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch { return null; }
  }

  async function loadProducts() {
    try {
      const data = await window.api.get('/products');
      const list = Array.isArray(data) ? data : (data.products || []);
      if (list.length) { allProducts = list; return allProducts; }
    } catch { /* fallthrough */ }
    allProducts = readLocalProducts() || MOCK_PRODUCTS;
    return allProducts;
  }

  async function loadProduct(id) {
    try {
      const data = await window.api.get(`/products/${id}`);
      const p = data.product || data;
      if (p && p.id) return p;
    } catch { /* fallthrough */ }
    const local = readLocalProducts();
    if (local) {
      const found = local.find((p) => String(p.id) === String(id));
      if (found) return found;
    }
    return MOCK_PRODUCTS.find((p) => String(p.id) === String(id)) || null;
  }

  function formatPrice(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }
  const CATEGORY_LABELS = { coffee: 'Кофе', tea: 'Чай', dessert: 'Десерт' };

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function getQtyInCart(id) {
    const item = (window.Cart?.get() || []).find((i) => String(i.id) === String(id));
    return item ? item.qty : 0;
  }

  function renderActions(product) {
    const qty = getQtyInCart(product.id);
    if (qty <= 0) {
      return `<button class="btn btn--primary" data-add-to-cart="${product.id}">В корзину</button>`;
    }
    return `
      <div class="qty-control">
        <button class="qty-btn" type="button" data-qty-dec="${product.id}" aria-label="Уменьшить">−</button>
        <input class="qty-input" type="number" min="1" inputmode="numeric"
               value="${qty}" data-qty-input="${product.id}" aria-label="Количество">
        <button class="qty-btn" type="button" data-qty-inc="${product.id}" aria-label="Увеличить">+</button>
      </div>
    `;
  }

  function forceRenderActions(id) {
    const el = document.querySelector(`[data-actions="${id}"]`);
    if (!el) return;
    const product = allProducts.find((p) => String(p.id) === String(id));
    if (product) el.innerHTML = renderActions(product);
  }

  function renderCard(p) {
    return `
      <article class="product-card">
        <a class="product-card__media" href="/product.html?id=${p.id}">
          <img src="${p.image_url || ''}" alt="${escapeHtml(p.name)}" loading="lazy">
        </a>
        <div class="product-card__body">
          <h3 class="product-card__title">
            <a href="/product.html?id=${p.id}" style="color: inherit;">${escapeHtml(p.name)}</a>
          </h3>
          <p class="product-card__desc">${escapeHtml(p.description || '')}</p>
          <div class="product-card__footer">
            <span class="price">${formatPrice(p.price)}</span>
            <div class="product-card__actions" data-actions="${p.id}">
              ${renderActions(p)}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function bindActions(root) {
    root.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add-to-cart]');
      if (addBtn) {
        const id = addBtn.getAttribute('data-add-to-cart');
        const product = allProducts.find((p) => String(p.id) === String(id));
        if (product) {
          window.Cart.add(product, 1);
          // Мгновенный отклик — не ждём события cart:updated
          forceRenderActions(id);
          window.showToast?.(`«${product.name}» добавлен в корзину`);
        }
        return;
      }

      const decBtn = e.target.closest('[data-qty-dec]');
      if (decBtn) {
        const id = decBtn.getAttribute('data-qty-dec');
        const input = decBtn.closest('[data-actions]')?.querySelector('[data-qty-input]');
        if (input) input.blur();
        const cur = getQtyInCart(id);
        if (cur <= 1) window.Cart.remove(id);
        else window.Cart.updateQty(id, cur - 1);
        forceRenderActions(id);
        return;
      }

      const incBtn = e.target.closest('[data-qty-inc]');
      if (incBtn) {
        const id = incBtn.getAttribute('data-qty-inc');
        const input = incBtn.closest('[data-actions]')?.querySelector('[data-qty-input]');
        if (input) input.blur();
        const cur = getQtyInCart(id);
        const product = allProducts.find((p) => String(p.id) === String(id));
        if (!product) return;
        if (cur === 0) window.Cart.add(product, 1);
        else window.Cart.updateQty(id, cur + 1);
        forceRenderActions(id);
        return;
      }
    });

    // Ручной ввод
    root.addEventListener('input', (e) => {
      const input = e.target.closest('[data-qty-input]');
      if (!input) return;
      const id = input.getAttribute('data-qty-input');
      const value = parseInt(input.value, 10);
      if (isNaN(value) || value < 1) return;
      const cur = getQtyInCart(id);
      if (value !== cur) {
        const product = allProducts.find((p) => String(p.id) === String(id));
        if (product) window.Cart.updateQty(id, value);
      }
    });

    // Потеря фокуса / Enter — финализируем
    root.addEventListener('change', (e) => {
      const input = e.target.closest('[data-qty-input]');
      if (!input) return;
      const id = input.getAttribute('data-qty-input');
      const raw = input.value.trim();
      if (raw === '') {
        const cur = getQtyInCart(id);
        if (cur > 0) { forceRenderActions(id); return; }
        window.Cart.remove(id);
      } else {
        const value = parseInt(raw, 10);
        if (isNaN(value) || value <= 0) window.Cart.remove(id);
        else window.Cart.updateQty(id, value);
      }
      forceRenderActions(id);
    });
  }

  // Синхронизация между вкладками и другими операциями.
  // Важно: НЕ перерисовывать, если пользователь печатает в поле qty,
  // иначе фокус потеряется. Кнопки/прочие элементы — перерисовываем всегда.
  function bindCartUpdates() {
    window.addEventListener('cart:updated', () => {
      const active = document.activeElement;
      document.querySelectorAll('[data-actions]').forEach((el) => {
        if (active && el.contains(active) && active.matches('[data-qty-input]')) return;
        const id = el.getAttribute('data-actions');
        const product = allProducts.find((p) => String(p.id) === String(id));
        if (product) el.innerHTML = renderActions(product);
      });
    });
  }

  async function initCatalog() {
    const grid = document.querySelector('[data-products]');
    if (!grid) return;

    grid.innerHTML = '<p class="text-muted">Загрузка товаров…</p>';
    await loadProducts();

    function applyFilters() {
      const search = (document.querySelector('[data-search]')?.value || '').trim().toLowerCase();
      const category = document.querySelector('[data-category-filter]')?.value || '';

      const filtered = allProducts.filter((p) => {
        const name = String(p.name || '').toLowerCase();
        return (!search || name.includes(search)) && (!category || p.category === category);
      });

      if (!filtered.length) {
        grid.innerHTML = '<p class="text-muted">Ничего не найдено. Попробуйте изменить фильтры.</p>';
        return;
      }
      grid.innerHTML = filtered.map(renderCard).join('');
    }

    document.querySelector('[data-search]')?.addEventListener('input', applyFilters);
    document.querySelector('[data-category-filter]')?.addEventListener('change', applyFilters);

    bindActions(grid);
    bindCartUpdates();
    applyFilters();
  }

  async function initProductPage() {
    const container = document.querySelector('[data-product]');
    if (!container) return;

    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
      container.innerHTML = '<p class="text-muted">Товар не найден. <a href="/">Вернуться в каталог</a></p>';
      return;
    }

    container.innerHTML = '<p class="text-muted">Загрузка…</p>';
    const p = await loadProduct(id);

    if (!p) {
      container.innerHTML = '<p class="text-muted">Товар не найден. <a href="/">Вернуться в каталог</a></p>';
      return;
    }
    if (!allProducts.find((x) => String(x.id) === String(p.id))) allProducts.push(p);

    document.title = `${p.name} — MyCoffeCup`;

    container.innerHTML = `
      <div class="product-detail">
        <div class="product-detail__media">
          <img src="${p.image_url || ''}" alt="${escapeHtml(p.name)}">
        </div>
        <div class="product-detail__content">
          <span class="badge badge--accent">${CATEGORY_LABELS[p.category] || p.category}</span>
          <h1 style="margin-top: var(--sp-2);">${escapeHtml(p.name)}</h1>
          <p class="price" style="font-size: var(--fs-2xl);">${formatPrice(p.price)}</p>
          <p class="text-muted">${escapeHtml(p.description || '')}</p>
          <div class="row" style="margin-top: var(--sp-4);">
            <div data-actions="${p.id}">${renderActions(p)}</div>
          </div>
          <p style="margin-top: var(--sp-4);">
            <a href="/">← Вернуться в каталог</a>
          </p>
        </div>
      </div>
    `;

    bindActions(container);
    bindCartUpdates();
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