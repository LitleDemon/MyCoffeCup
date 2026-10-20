/**
 * admin.js — общий скрипт для всех страниц админки.
 * Определяет страницу по URL и инициализирует нужный раздел.
 *
 * Данные до появления бэкенда хранятся в localStorage:
 *   mock_products, mock_posts — используются также catalog.js и blog.js.
 *   mock_orders — только для админки.
 *
 * Цвета Chart.js подогнаны под картонную тему (Eco Cardboard):
 *   primary = #2D6A4F, accent = #B5651D, grid = #C9B896.
 */

(function () {
  /* ============================================================
     Общие утилиты
     ============================================================ */

  const fmtPrice = (n) => Number(n).toLocaleString('ru-RU') + ' ₽';

  /* Цвета темы для графиков */
  const CHART_COLORS = {
    primary: '#2D6A4F',       // лесной зелёный
    primaryHover: '#1B4332',  // тёмный зелёный
    accent: '#B5651D',        // глина/охра
    warning: '#C78C2E',       // охра светлее
    grid: '#C9B896',          // край картона — линии сетки
    text: '#5C5242',          // серо-коричневый текст
  };

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

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function readMock(key, fallback) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(data) ? data : fallback;
    } catch {
      return fallback;
    }
  }
  function writeMock(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  /* Модалки — открытие/закрытие по data-атрибутам */
  function bindModal(modalSelector) {
    const modal = document.querySelector(modalSelector);
    if (!modal) return { open: () => {}, close: () => {}, setTitle: () => {} };

    const titleEl = modal.querySelector('[data-modal-title]');
    const openBtns = document.querySelectorAll('[data-open-product-modal], [data-open-post-modal]');

    function open() {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
    }
    function close() {
      modal.hidden = true;
      document.body.style.overflow = '';
    }

    modal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

    openBtns.forEach((btn) => {
      const target = btn.getAttribute('data-open-product-modal') !== null
        ? '[data-product-modal]'
        : btn.getAttribute('data-open-post-modal') !== null
          ? '[data-post-modal]' : null;
      if (target === modalSelector || modal.matches(modalSelector)) {
        btn.addEventListener('click', open);
      }
    });

    return {
      open,
      close,
      setTitle: (t) => { if (titleEl) titleEl.textContent = t; },
    };
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */

  async function initDashboard() {
    const kpis = await loadKpis();
    document.querySelectorAll('[data-kpi-revenue]').forEach((el) => (el.textContent = fmtPrice(kpis.revenue)));
    document.querySelectorAll('[data-kpi-orders]').forEach((el) => (el.textContent = kpis.orders));
    document.querySelectorAll('[data-kpi-avg]').forEach((el) => (el.textContent = fmtPrice(kpis.avgCheck)));
    document.querySelectorAll('[data-kpi-users]').forEach((el) => (el.textContent = kpis.newUsers));

    if (typeof Chart !== 'undefined') {
      renderSalesChart(kpis.salesByDay);
      renderTopProductsChart(kpis.topProducts);
    }

    const orders = await loadOrders();
    const tbody = document.querySelector('[data-admin-recent-orders]');
    if (tbody) {
      const recent = orders.slice(0, 5);
      if (!recent.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Нет заказов</td></tr>';
      } else {
        tbody.innerHTML = recent.map((o) => `
          <tr>
            <td>#${o.id}</td>
            <td>${escapeHtml(o.customer || '—')}</td>
            <td>${fmtPrice(o.total)}</td>
            <td><span class="badge ${STATUS_CLASS[o.status] || 'badge--new'}">${STATUS_LABEL[o.status] || o.status}</span></td>
            <td>${new Date(o.created_at).toLocaleDateString('ru-RU')}</td>
          </tr>
        `).join('');
      }
    }
  }

  async function loadKpis() {
    try {
      return await window.api.get('/admin/stats');
    } catch {
      return {
        revenue: 128_450,
        orders: 342,
        avgCheck: 376,
        newUsers: 48,
        salesByDay: [
          { day: 'Пн', value: 18400 }, { day: 'Вт', value: 21200 },
          { day: 'Ср', value: 16800 }, { day: 'Чт', value: 23400 },
          { day: 'Пт', value: 28900 }, { day: 'Сб', value: 31200 },
          { day: 'Вс', value: 24100 },
        ],
        topProducts: [
          { name: 'Латте',     value: 128 },
          { name: 'Капучино',  value: 96  },
          { name: 'Круассан',  value: 74  },
          { name: 'Чизкейк',   value: 58  },
          { name: 'Американо', value: 43  },
        ],
      };
    }
  }

  async function loadOrders() {
    try {
      const data = await window.api.get('/admin/orders');
      const list = Array.isArray(data) ? data : (data.orders || []);
      if (list.length) return list;
    } catch { /* fallthrough */ }
    return readMock('mock_orders', []);
  }

  function renderSalesChart(salesByDay) {
    const canvas = document.getElementById('chart-sales');
    if (!canvas) return;
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: salesByDay.map((d) => d.day),
        datasets: [{
          label: 'Выручка, ₽',
          data: salesByDay.map((d) => d.value),
          backgroundColor: CHART_COLORS.primary,
          hoverBackgroundColor: CHART_COLORS.primaryHover,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: CHART_COLORS.primaryHover,
            titleColor: '#FBF7EE',
            bodyColor: '#FBF7EE',
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: CHART_COLORS.grid },
            ticks: { color: CHART_COLORS.text },
          },
          x: {
            grid: { display: false },
            ticks: { color: CHART_COLORS.text },
          },
        },
      },
    });
  }

  function renderTopProductsChart(top) {
    const canvas = document.getElementById('chart-top-products');
    if (!canvas) return;
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: top.map((p) => p.name),
        datasets: [{
          label: 'Продано',
          data: top.map((p) => p.value),
          backgroundColor: CHART_COLORS.accent,
          hoverBackgroundColor: CHART_COLORS.warning,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: CHART_COLORS.primaryHover,
            titleColor: '#FBF7EE',
            bodyColor: '#FBF7EE',
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: CHART_COLORS.grid },
            ticks: { color: CHART_COLORS.text },
          },
          y: {
            grid: { display: false },
            ticks: { color: CHART_COLORS.text },
          },
        },
      },
    });
  }

  /* ============================================================
     PRODUCTS
     ============================================================ */

  async function initProducts() {
    const tbody = document.querySelector('[data-products-table]');
    const modal = bindModal('[data-product-modal]');
    const form = document.querySelector('[data-product-form]');
    if (!tbody || !form) return;

    let products = await loadProductsAdmin();

    function render() {
      if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Товаров пока нет</td></tr>';
        return;
      }
      tbody.innerHTML = products.map((p) => `
        <tr>
          <td>${p.id}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.category)}</td>
          <td>${fmtPrice(p.price)}</td>
          <td>${p.stock}</td>
          <td class="table-actions">
            <button class="btn" data-edit="${p.id}" title="Редактировать">✎</button>
            <button class="btn" data-delete="${p.id}" title="Удалить">🗑</button>
          </td>
        </tr>
      `).join('');
    }

    function openForCreate() {
      form.reset();
      form.querySelector('[name="id"]').value = '';
      modal.setTitle('Новый товар');
      modal.open();
    }
    function openForEdit(p) {
      form.reset();
      form.querySelector('[name="id"]').value = p.id;
      form.querySelector('[name="name"]').value = p.name || '';
      form.querySelector('[name="category"]').value = p.category || 'coffee';
      form.querySelector('[name="price"]').value = p.price;
      form.querySelector('[name="stock"]').value = p.stock;
      form.querySelector('[name="image_url"]').value = p.image_url || '';
      form.querySelector('[name="description"]').value = p.description || '';
      modal.setTitle('Редактировать товар');
      modal.open();
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      const data = {
        name: fd.get('name').trim(),
        category: fd.get('category'),
        price: Number(fd.get('price')),
        stock: Number(fd.get('stock')),
        image_url: fd.get('image_url').trim() || 'https://picsum.photos/seed/' + Date.now() + '/600/450',
        description: fd.get('description').trim(),
      };

      if (id) {
        const idx = products.findIndex((p) => String(p.id) === String(id));
        if (idx !== -1) products[idx] = { ...products[idx], ...data };
      } else {
        data.id = Date.now();
        products.push(data);
      }
      writeMock('mock_products', products);
      render();
      modal.close();
      window.showToast?.('Товар сохранён (локально)');
    });

    tbody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit]');
      const delBtn = e.target.closest('[data-delete]');
      if (editBtn) {
        const p = products.find((x) => String(x.id) === editBtn.getAttribute('data-edit'));
        if (p) openForEdit(p);
      }
      if (delBtn) {
        if (!confirm('Удалить товар?')) return;
        const id = delBtn.getAttribute('data-delete');
        products = products.filter((p) => String(p.id) !== String(id));
        writeMock('mock_products', products);
        render();
        window.showToast?.('Товар удалён (локально)');
      }
    });

    document.querySelector('[data-open-product-modal]')?.addEventListener('click', openForCreate);
    render();
  }

  async function loadProductsAdmin() {
    try {
      const data = await window.api.get('/products');
      const list = Array.isArray(data) ? data : (data.products || []);
      if (list.length) return list;
    } catch { /* fallthrough */ }
    return readMock('mock_products', [
      { id: 1, name: 'Эспрессо', category: 'coffee', price: 150, stock: 100, description: '', image_url: 'https://picsum.photos/seed/espresso/600/450' },
      { id: 3, name: 'Латте',    category: 'coffee', price: 280, stock: 80,  description: '', image_url: 'https://picsum.photos/seed/latte/600/450' },
      { id: 7, name: 'Круассан', category: 'dessert', price: 180, stock: 30, description: '', image_url: 'https://picsum.photos/seed/croissant/600/450' },
    ]);
  }

  /* ============================================================
     CONTENT (blog)
     ============================================================ */

  async function initContent() {
    const tbody = document.querySelector('[data-posts-table]');
    const modal = bindModal('[data-post-modal]');
    const form = document.querySelector('[data-post-form]');
    if (!tbody || !form) return;

    let posts = await loadPostsAdmin();

    function render() {
      if (!posts.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Статей пока нет</td></tr>';
        return;
      }
      tbody.innerHTML = posts.map((p) => `
        <tr>
          <td>${p.id}</td>
          <td>${escapeHtml(p.title)}</td>
          <td>${new Date(p.created_at).toLocaleDateString('ru-RU')}</td>
          <td>${escapeHtml(p.author || '—')}</td>
          <td class="table-actions">
            <button class="btn" data-edit="${p.id}" title="Редактировать">✎</button>
            <button class="btn" data-delete="${p.id}" title="Удалить">🗑</button>
          </td>
        </tr>
      `).join('');
    }

    function openForCreate() {
      form.reset();
      form.querySelector('[name="id"]').value = '';
      modal.setTitle('Новая статья');
      modal.open();
    }
    function openForEdit(p) {
      form.reset();
      form.querySelector('[name="id"]').value = p.id;
      form.querySelector('[name="title"]').value = p.title || '';
      form.querySelector('[name="excerpt"]').value = p.excerpt || '';
      form.querySelector('[name="cover_url"]').value = p.cover_url || '';
      form.querySelector('[name="body"]').value = p.body || '';
      modal.setTitle('Редактировать статью');
      modal.open();
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      const user = window.api.getUser();
      const data = {
        title: fd.get('title').trim(),
        excerpt: fd.get('excerpt').trim(),
        cover_url: fd.get('cover_url').trim() || 'https://picsum.photos/seed/post' + Date.now() + '/1200/600',
        body: fd.get('body').trim(),
      };

      if (id) {
        const idx = posts.findIndex((p) => String(p.id) === String(id));
        if (idx !== -1) posts[idx] = { ...posts[idx], ...data };
      } else {
        data.id = Date.now();
        data.author = user?.name || 'Администратор';
        data.created_at = new Date().toISOString();
        posts.unshift(data);
      }
      writeMock('mock_posts', posts);
      render();
      modal.close();
      window.showToast?.('Статья сохранена (локально)');
    });

    tbody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit]');
      const delBtn = e.target.closest('[data-delete]');
      if (editBtn) {
        const p = posts.find((x) => String(x.id) === editBtn.getAttribute('data-edit'));
        if (p) openForEdit(p);
      }
      if (delBtn) {
        if (!confirm('Удалить статью?')) return;
        const id = delBtn.getAttribute('data-delete');
        posts = posts.filter((p) => String(p.id) !== String(id));
        writeMock('mock_posts', posts);
        render();
        window.showToast?.('Статья удалена (локально)');
      }
    });

    document.querySelector('[data-open-post-modal]')?.addEventListener('click', openForCreate);
    render();
  }

  async function loadPostsAdmin() {
    try {
      const data = await window.api.get('/posts');
      const list = Array.isArray(data) ? data : (data.posts || []);
      if (list.length) return list;
    } catch { /* fallthrough */ }
    const local = readMock('mock_posts', null);
    if (local) return local;
    return [
      { id: 1, title: 'Как выбрать зерно для дома', created_at: '2025-10-12', author: 'Степан', excerpt: '', cover_url: '', body: '' },
      { id: 2, title: 'Почему латте-арт — это не главное', created_at: '2025-10-05', author: 'Степан', excerpt: '', cover_url: '', body: '' },
    ];
  }

  /* ============================================================
     ORDERS
     ============================================================ */

  async function initOrders() {
    const tbody = document.querySelector('[data-orders-table]');
    const filter = document.querySelector('[data-status-filter]');
    if (!tbody) return;

    let orders = await loadOrders();
    let statusFilter = '';

    function render() {
      const filtered = statusFilter
        ? orders.filter((o) => o.status === statusFilter)
        : orders;

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Заказов нет</td></tr>';
        return;
      }
      tbody.innerHTML = filtered.map((o) => `
        <tr>
          <td>#${o.id}</td>
          <td>${escapeHtml(o.customer || '—')}</td>
          <td>${fmtPrice(o.total)}</td>
          <td>
            <select class="select" data-order-status="${o.id}" style="padding: 6px 10px;">
              ${Object.keys(STATUS_LABEL).map((s) =>
                `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`
              ).join('')}
            </select>
          </td>
          <td>${new Date(o.created_at).toLocaleDateString('ru-RU')}</td>
          <td class="table-actions">
            <button class="btn" data-receipt="${o.id}" title="Чек">🧾</button>
          </td>
        </tr>
      `).join('');
    }

    if (filter) {
      filter.addEventListener('change', () => {
        statusFilter = filter.value;
        render();
      });
    }

    tbody.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-order-status]');
      if (!sel) return;
      const id = sel.getAttribute('data-order-status');
      const order = orders.find((o) => String(o.id) === String(id));
      if (order) {
        order.status = sel.value;
        writeMock('mock_orders', orders);
        window.showToast?.(`Статус заказа #${id} — ${STATUS_LABEL[sel.value]}`);
      }
    });

    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-receipt]');
      if (!btn) return;
      const id = btn.getAttribute('data-receipt');
      const order = orders.find((o) => String(o.id) === String(id));
      if (!order) return;
      const w = window.open('', '_blank');
      w.document.write(`
        <pre style="font-family: monospace; padding: 20px; font-size: 14px; background: #FBF7EE; color: #1C2B22;">
    ╔══════════════════════════════════════╗
    ║             MyCoffeCup               ║
    ║Новосибирск. Улица Красный Проспект 38║
    ╚══════════════════════════════════════╝

    Заказ #${order.id}
    Дата:  ${new Date(order.created_at).toLocaleString('ru-RU')}
    Клиент: ${order.customer || '—'}
    ────────────────────────────────────
    ${(order.items || []).map((it) =>
      `${it.name || it.product_id} × ${it.qty} = ${fmtPrice((it.price || 0) * it.qty)}`
    ).join('\n    ')}
    ────────────────────────────────────
    ИТОГО: ${fmtPrice(order.total)}
    Статус: ${STATUS_LABEL[order.status] || order.status}
    ────────────────────────────────────
        Спасибо за заказ!
        </pre>
      `);
    });

    render();
  }

  /* ============================================================
     Роутинг по странице
     ============================================================ */

  function init() {
    const path = location.pathname;
    if (path.includes('/dashboard'))      initDashboard();
    else if (path.includes('/products'))  initProducts();
    else if (path.includes('/content'))   initContent();
    else if (path.includes('/orders'))    initOrders();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();