/**
 * admin.js — общий скрипт для всех страниц админки.
 * Определяет страницу по URL и инициализирует нужный раздел.
 *
 * Заказы, товары, статьи — через API. Без моков:
 * если в БД пусто — таблица пуста.
 *
 * Графики: Chart.js подключается локально из /js/vendor/chart.umd.min.js.
 * Анимация отключена — иначе при «плавающем» размере canvas
 * Chart.js может уйти в бесконечный цикл перерисовки.
 */

(function () {
  /* ============================================================
     Общие утилиты
     ============================================================ */

  const fmtPrice = (n) => Number(n).toLocaleString('ru-RU') + ' ₽';

  const CHART_COLORS = {
    primary: '#2D6A4F',
    primaryHover: '#1B4332',
    accent: '#B5651D',
    warning: '#C78C2E',
    grid: '#C9B896',
    text: '#5C5242',
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

  /* Модалки */
  function bindModal(modalSelector) {
    const modal = document.querySelector(modalSelector);
    if (!modal) return { open: () => {}, close: () => {}, setTitle: () => {} };

    const titleEl = modal.querySelector('[data-modal-title]');
    const openBtns = document.querySelectorAll('[data-open-product-modal], [data-open-post-modal], [data-open-topping-modal]');

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
      const target = btn.hasAttribute('data-open-product-modal') ? '[data-product-modal]'
        : btn.hasAttribute('data-open-post-modal') ? '[data-post-modal]'
        : btn.hasAttribute('data-open-topping-modal') ? '[data-topping-modal]'
        : null;
      if (target === modalSelector) btn.addEventListener('click', open);
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
      try { renderSalesChart(Array.isArray(kpis.salesByDay) ? kpis.salesByDay : []); }
      catch (err) { console.error('Ошибка графика «Продажи по дням»:', err); }
      try { renderTopProductsChart(Array.isArray(kpis.topProducts) ? kpis.topProducts : []); }
      catch (err) { console.error('Ошибка графика «Топ товаров»:', err); }
    } else {
      console.warn('Chart.js не загружен — графики не отрисованы');
      document.querySelectorAll('.chart-wrap').forEach((wrap) => {
        wrap.innerHTML = '<p class="text-muted" style="display:flex;align-items:center;justify-content:center;height:100%;margin:0;">Не удалось загрузить библиотеку графиков</p>';
      });
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
            <td>${escapeHtml(o.customer_name || o.customer || '—')}</td>
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
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        window.showToast?.('Требуется вход администратора');
        setTimeout(() => (location.href = '/login.html'), 700);
      } else if (!err.isNetworkError) {
        console.warn('stats API:', err.message);
      }
      return {
        revenue: 0,
        orders: 0,
        avgCheck: 0,
        newUsers: 0,
        salesByDay: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day) => ({ day, value: 0 })),
        topProducts: [],
      };
    }
  }

  async function loadOrders() {
    try {
      const data = await window.api.get('/orders');
      return Array.isArray(data) ? data : (data.orders || []);
    } catch (err) {
      if (err.isNetworkError) return readMock('mock_orders', []);
      return [];
    }
  }

  function renderSalesChart(salesByDay) {
    const canvas = document.getElementById('chart-sales');
    if (!canvas) return;

    if (!Array.isArray(salesByDay) || !salesByDay.length) {
      salesByDay = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day) => ({ day, value: 0 }));
    }

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
        animation: false,
        resizeDelay: 200,
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
          y: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.text } },
          x: { grid: { display: false }, ticks: { color: CHART_COLORS.text } },
        },
      },
    });
  }

  function renderTopProductsChart(top) {
    const canvas = document.getElementById('chart-top-products');
    if (!canvas) return;

    if (!Array.isArray(top) || !top.length) top = [{ name: 'Нет данных', value: 0 }];

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
        animation: false,
        resizeDelay: 200,
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
          x: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.text } },
          y: { grid: { display: false }, ticks: { color: CHART_COLORS.text } },
        },
      },
    });
  }

  /* ============================================================
     PRODUCTS
     ============================================================ */

  const SIZE_CODES = ['S', 'M', 'L'];

  async function initProducts() {
    const tbody = document.querySelector('[data-products-table]');
    const modal = bindModal('[data-product-modal]');
    const form = document.querySelector('[data-product-form]');
    if (!tbody || !form) return;

    let products = await loadProductsAdmin();

    /* Переключение полей по категории */
    const categorySelect = form.querySelector('[name="category"]');
    const priceField = form.querySelector('[data-price-field]');
    const sizesField = form.querySelector('[data-sizes-field]');
    const priceInput = form.querySelector('[name="price"]');

    function toggleFieldsByCategory() {
      if (!categorySelect) return;
      const isDrink = categorySelect.value === 'coffee' || categorySelect.value === 'tea';
      if (priceField) priceField.hidden = isDrink;
      if (sizesField) sizesField.hidden = !isDrink;
      if (priceInput) priceInput.required = !isDrink;
    }
    categorySelect?.addEventListener('change', toggleFieldsByCategory);

    /* Размеры: чекбокс включает/выключает цену */
    SIZE_CODES.forEach((code) => {
      const check = form.querySelector(`[data-size-check="${code}"]`);
      const input = form.querySelector(`[data-size-price="${code}"]`);
      if (!check || !input) return;
      check.addEventListener('change', () => {
        input.disabled = !check.checked;
        if (!check.checked) input.value = '';
      });
    });

    /* Drag&drop изображения */
    setupImageDropzone(form);

    /* Рендер таблицы */
    function render() {
      if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-muted">Товаров пока нет</td></tr>';
        return;
      }
      tbody.innerHTML = products.map((p) => {
        const sizes = Array.isArray(p.sizes) && p.sizes.length
          ? p.sizes.map((s) => `${s.code} ${fmtPrice(s.price)}`).join(' · ')
          : '—';
        return `
          <tr>
            <td>${p.id}</td>
            <td>${p.image_url ? `<img src="${p.image_url}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">` : '—'}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.category)}</td>
            <td>${fmtPrice(p.price)}</td>
            <td style="font-size: var(--fs-xs);">${sizes}</td>
            <td>${p.is_seasonal ? '<span class="badge badge--accent">сезон</span>' : '—'}</td>
            <td class="table-actions">
              <button class="btn" data-edit="${p.id}" title="Редактировать">✎</button>
              <button class="btn" data-delete="${p.id}" title="Удалить">🗑</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function openForCreate() {
      form.reset();
      form.querySelector('[name="id"]').value = '';
      form.querySelector('[name="image_url"]').value = '';
      resetDropzonePreview(form);
      SIZE_CODES.forEach((code) => {
        const check = form.querySelector(`[data-size-check="${code}"]`);
        const inp = form.querySelector(`[data-size-price="${code}"]`);
        if (check) check.checked = false;
        if (inp) { inp.disabled = true; inp.value = ''; }
      });
      toggleFieldsByCategory();
      modal.setTitle('Новый товар');
      modal.open();
    }

    function openForEdit(p) {
      form.reset();
      form.querySelector('[name="id"]').value = p.id;
      form.querySelector('[name="name"]').value = p.name || '';
      form.querySelector('[name="category"]').value = p.category || 'coffee';
      form.querySelector('[name="description"]').value = p.description || '';
      form.querySelector('[name="price"]').value = p.price || '';
      form.querySelector('[name="image_url"]').value = p.image_url || '';
      form.querySelector('[name="is_seasonal"]').checked = Boolean(p.is_seasonal);

      SIZE_CODES.forEach((code) => {
        const check = form.querySelector(`[data-size-check="${code}"]`);
        const inp = form.querySelector(`[data-size-price="${code}"]`);
        if (!check || !inp) return;
        const found = Array.isArray(p.sizes) ? p.sizes.find((s) => s.code === code) : null;
        check.checked = Boolean(found);
        inp.disabled = !found;
        inp.value = found ? found.price : '';
      });

      setDropzonePreview(form, p.image_url);
      toggleFieldsByCategory();
      modal.setTitle('Редактировать товар');
      modal.open();
    }

    function collectPayload() {
      const fd = new FormData(form);
      const category = fd.get('category');
      const isDrink = category === 'coffee' || category === 'tea';

      const payload = {
        name: fd.get('name').trim(),
        category,
        description: fd.get('description').trim(),
        image_url: fd.get('image_url') || null,
        is_seasonal: fd.get('is_seasonal') === 'on',
      };

      if (isDrink) {
        const sizes = [];
        SIZE_CODES.forEach((code) => {
          const check = form.querySelector(`[data-size-check="${code}"]`);
          const price = form.querySelector(`[data-size-price="${code}"]`)?.value;
          if (check?.checked && price !== '') {
            sizes.push({ code, price: Number(price) });
          }
        });
        if (!sizes.length) throw new Error('Отметьте хотя бы один размер и укажите цену');
        payload.sizes = sizes;
        payload.price = Math.min(...sizes.map((s) => s.price));
      } else {
        payload.sizes = null;
        payload.price = Number(fd.get('price'));
        if (isNaN(payload.price) || payload.price < 0) throw new Error('Укажите корректную цену');
      }
      return payload;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = form.querySelector('[data-error]');
      errorEl.hidden = true;

      let payload;
      try {
        payload = collectPayload();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        return;
      }

      const id = form.querySelector('[name="id"]').value;

      try {
        let saved;
        if (id) saved = await window.api.put(`/products/${id}`, payload);
        else saved = await window.api.post('/products', payload);

        if (id) {
          const idx = products.findIndex((p) => String(p.id) === String(id));
          if (idx !== -1) products[idx] = saved;
        } else {
          products.push(saved);
        }
        render();
        modal.close();
        window.showToast?.('Товар сохранён');
      } catch (err) {
        if (err.isNetworkError) {
          window.showToast?.('Нет связи с сервером');
        } else {
          errorEl.textContent = err.message || 'Не удалось сохранить товар';
          errorEl.hidden = false;
        }
      }
    });

    tbody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit]');
      const delBtn = e.target.closest('[data-delete]');
      if (editBtn) {
        const p = products.find((x) => String(x.id) === editBtn.getAttribute('data-edit'));
        if (p) openForEdit(p);
      }
      if (delBtn) {
        if (!confirm('Удалить товар?')) return;
        const id = delBtn.getAttribute('data-delete');
        try {
          await window.api.delete(`/products/${id}`);
          products = products.filter((p) => String(p.id) !== String(id));
          render();
          window.showToast?.('Товар удалён');
        } catch (err) {
          if (err.status === 404) {
            products = products.filter((p) => String(p.id) !== String(id));
            render();
            window.showToast?.('Товар уже отсутствовал в БД — убран из списка');
          } else {
            window.showToast?.(err.message || 'Не удалось удалить товар');
          }
        }
      }
    });

    document.querySelector('[data-open-product-modal]')?.addEventListener('click', openForCreate);
    render();
  }

  async function loadProductsAdmin() {
    try {
      const data = await window.api.get('/products');
      return Array.isArray(data) ? data : (data.products || []);
    } catch (err) {
      console.warn('Не удалось загрузить товары:', err.message);
      return [];
    }
  }

  /* --- Drag&drop загрузки изображения --- */

  function setupImageDropzone(form) {
    const dropzone = form.querySelector('[data-dropzone]');
    const input = form.querySelector('[data-image-input]');
    if (!dropzone || !input) return;

    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('[data-clear-image]')) return;
      input.click();
    });

    input.addEventListener('change', () => {
      if (input.files && input.files[0]) uploadFile(input.files[0]);
    });

    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dropzone--over');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dropzone--over');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    });

    async function uploadFile(file) {
      if (!/^image\//.test(file.type)) {
        window.showToast?.('Только изображения');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        window.showToast?.('Файл больше 5 МБ');
        return;
      }

      const fd = new FormData();
      fd.append('image', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${window.api.getToken()}` },
          body: fd,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Ошибка ${res.status}`);
        }
        const data = await res.json();
        form.querySelector('[name="image_url"]').value = data.url;
        setDropzonePreview(form, data.url);
        window.showToast?.('Изображение загружено');
      } catch (err) {
        resetDropzonePreview(form);
        window.showToast?.(err.message || 'Не удалось загрузить файл');
      }
    }
  }

  function setDropzonePreview(form, url) {
    const preview = form.querySelector('[data-image-preview]');
    const hint = form.querySelector('[data-image-hint]');
    if (!preview || !hint) return;

    if (url) {
      preview.innerHTML = `
        <img src="${url}" alt="preview">
        <button type="button" class="dropzone__clear" data-clear-image title="Удалить">✕</button>
      `;
      preview.hidden = false;
      hint.hidden = true;
      preview.querySelector('[data-clear-image]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        form.querySelector('[name="image_url"]').value = '';
        resetDropzonePreview(form);
      });
    } else {
      resetDropzonePreview(form);
    }
  }

  function resetDropzonePreview(form) {
    const preview = form.querySelector('[data-image-preview]');
    const hint = form.querySelector('[data-image-hint]');
    if (preview) { preview.innerHTML = ''; preview.hidden = true; }
    if (hint) {
      hint.hidden = false;
      hint.innerHTML = `
        <span class="dropzone__icon">🖼</span>
        <span>Перетащите изображение сюда или <u>выберите файл</u></span>
        <small class="text-muted">JPEG, PNG, WebP, GIF — до 5 МБ</small>
      `;
    }
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      const data = {
        title: fd.get('title').trim(),
        excerpt: fd.get('excerpt').trim(),
        cover_url: fd.get('cover_url').trim() || 'https://picsum.photos/seed/post' + Date.now() + '/1200/600',
        body: fd.get('body').trim(),
      };

      try {
        let saved;
        if (id) saved = await window.api.put(`/posts/${id}`, data);
        else saved = await window.api.post('/posts', data);

        if (id) {
          const idx = posts.findIndex((p) => String(p.id) === String(id));
          if (idx !== -1) posts[idx] = saved;
        } else {
          posts.unshift(saved);
        }
        render();
        modal.close();
        window.showToast?.('Статья сохранена');
      } catch (err) {
        if (err.isNetworkError) {
          window.showToast?.('Нет связи с сервером');
        } else {
          window.showToast?.(err.message || 'Не удалось сохранить статью');
        }
      }
    });

    tbody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit]');
      const delBtn = e.target.closest('[data-delete]');
      if (editBtn) {
        const p = posts.find((x) => String(x.id) === editBtn.getAttribute('data-edit'));
        if (p) openForEdit(p);
      }
      if (delBtn) {
        if (!confirm('Удалить статью?')) return;
        const id = delBtn.getAttribute('data-delete');
        try {
          await window.api.delete(`/posts/${id}`);
          posts = posts.filter((p) => String(p.id) !== String(id));
          render();
          window.showToast?.('Статья удалена');
        } catch (err) {
          if (err.status === 404) {
            posts = posts.filter((p) => String(p.id) !== String(id));
            render();
            window.showToast?.('Статья уже отсутствовала в БД — убрана из списка');
          } else {
            window.showToast?.(err.message || 'Не удалось удалить статью');
          }
        }
      }
    });

    document.querySelector('[data-open-post-modal]')?.addEventListener('click', openForCreate);
    render();
  }

  async function loadPostsAdmin() {
    try {
      const data = await window.api.get('/posts');
      return Array.isArray(data) ? data : (data.posts || []);
    } catch (err) {
      console.warn('Не удалось загрузить статьи:', err.message);
      return [];
    }
  }

  /* ============================================================
     ORDERS
     ============================================================ */

  async function initOrders() {
    const tbody = document.querySelector('[data-orders-table]');
    const filter = document.querySelector('[data-status-filter]');
    if (!tbody) return;

    let orders = [];
    let statusFilter = '';

    async function fetchOrders() {
      try {
        const url = statusFilter ? `/orders?status=${encodeURIComponent(statusFilter)}` : '/orders';
        const data = await window.api.get(url);
        orders = Array.isArray(data) ? data : (data.orders || []);
      } catch (err) {
        if (err.isNetworkError) {
          orders = readMock('mock_orders', []);
          orders = statusFilter ? orders.filter((o) => o.status === statusFilter) : orders;
        } else {
          window.showToast?.(err.message || 'Не удалось загрузить заказы');
          orders = [];
        }
      }
    }

    function render() {
      if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Заказов нет</td></tr>';
        return;
      }
      tbody.innerHTML = orders.map((o) => `
        <tr>
          <td>#${o.id}</td>
          <td>${escapeHtml(o.customer_name || o.customer || '—')}</td>
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

    async function reload() {
      await fetchOrders();
      render();
    }

    if (filter) {
      filter.addEventListener('change', async () => {
        statusFilter = filter.value;
        await reload();
      });
    }

    tbody.addEventListener('change', async (e) => {
      const sel = e.target.closest('[data-order-status]');
      if (!sel) return;
      const id = sel.getAttribute('data-order-status');
      const newStatus = sel.value;

      try {
        await window.api.patch(`/orders/${id}/status`, { status: newStatus });
        const order = orders.find((o) => String(o.id) === String(id));
        if (order) order.status = newStatus;
        window.showToast?.(`Статус заказа #${id} — ${STATUS_LABEL[newStatus]}`);
      } catch (err) {
        window.showToast?.(err.message || 'Не удалось изменить статус');
        await reload();
      }
    });

    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-receipt]');
      if (!btn) return;
      const id = btn.getAttribute('data-receipt');
      const order = orders.find((o) => String(o.id) === String(id));
      if (!order) return;
      const items = order.items || [];
      const w = window.open('', '_blank');
      w.document.write(`
        <pre style="font-family: monospace; padding: 20px; font-size: 14px; background: #FBF7EE; color: #1C2B22;">
    ╔══════════════════════════════════════════╗
    ║              MyCoffeCup                  ║
    ║  Новосибирск, Ул. Красный Проспект 38    ║
    ╚══════════════════════════════════════════╝

    Заказ #${order.id}
    Дата:  ${new Date(order.created_at).toLocaleString('ru-RU')}
    Клиент: ${order.customer_name || '—'}
    ────────────────────────────────────────────
    ${items.map((it) =>
      `${it.name || 'Товар'} × ${it.qty} = ${fmtPrice((Number(it.price) || 0) * it.qty)}`
    ).join('\n    ')}
    ────────────────────────────────────────────
    ИТОГО: ${fmtPrice(order.total)}
    Статус: ${STATUS_LABEL[order.status] || order.status}
    ────────────────────────────────────────────
              Спасибо за заказ!
        </pre>
      `);
    });

    await reload();
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