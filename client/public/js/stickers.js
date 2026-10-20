/**
 * stickers.js — drag-and-drop стикеры + текстовые элементы на открытке.
 * Стикеры и текст можно двигать, масштабировать (0.5–3×) и поворачивать (0–360°).
 * Данные хранятся в localStorage.stickers.
 * window.getOrderStickers / window.clearOrderStickers — API для cart.js.
 */

(function () {
  const STICKERS = ['☕', '🥐', '🍰', '🌸', '❤️', '⭐', '🎉', '🍪', '🥛', '🍫', '🍓', '🌿'];
  const STICKERS_KEY = 'stickers';

  function loadStickers() {
    try {
      const data = JSON.parse(localStorage.getItem(STICKERS_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }
  function saveStickers(list) {
    localStorage.setItem(STICKERS_KEY, JSON.stringify(list));
  }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function genId() { return 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

  function init() {
    const canvas = document.querySelector('[data-stickers-canvas]');
    const palette = document.querySelector('[data-stickers-palette]');
    if (!canvas || !palette) return;

    const textInput = document.querySelector('[data-stickers-text]');
    const addTextBtn = document.querySelector('[data-stickers-add-text]');
    const controls = document.querySelector('[data-stickers-controls]');
    const scaleRange = controls?.querySelector('[data-control-scale]');
    const rotateRange = controls?.querySelector('[data-control-rotate]');
    const scaleValue = controls?.querySelector('[data-control-scale-value]');
    const rotateValue = controls?.querySelector('[data-control-rotate-value]');
    const deleteBtn = controls?.querySelector('[data-control-delete]');

    /* ---------- Палитра ---------- */
    palette.innerHTML = STICKERS.map((s) =>
      `<span class="sticker-chip" draggable="true" data-sticker="${s}">${s}</span>`
    ).join('');

    /* ---------- Состояние ---------- */
    let placed = loadStickers();
    let activeId = null;

    /* ---------- Рендер ---------- */
    function renderAll() {
      canvas.querySelectorAll('.sticker-item').forEach((el) => el.remove());
      const placeholder = canvas.querySelector('.stickers-placeholder');
      if (placeholder) placeholder.hidden = placed.length > 0;

      placed.forEach((item) => {
        const el = document.createElement('div');
        el.className = 'sticker-item';
        if (item.type === 'text') el.classList.add('sticker-item--text');
        if (activeId === item.id) el.classList.add('sticker-item--active');
        el.dataset.id = item.id;
        el.style.left = item.x + '%';
        el.style.top = item.y + '%';
        el.style.transform =
          `translate(-50%, -50%) rotate(${item.rotation || 0}deg) scale(${item.scale || 1})`;
        el.textContent = item.content;

        el.addEventListener('pointerdown', (e) => onPointerDown(e, item, el));
        canvas.appendChild(el);
      });

      updateControls();
    }

    function updateControls() {
      if (!controls) return;
      if (!activeId) { controls.hidden = true; return; }
      const item = placed.find((i) => i.id === activeId);
      if (!item) { controls.hidden = true; return; }
      controls.hidden = false;
      if (scaleRange) scaleRange.value = item.scale || 1;
      if (rotateRange) rotateRange.value = item.rotation || 0;
      if (scaleValue) scaleValue.textContent = (item.scale || 1).toFixed(1);
      if (rotateValue) rotateValue.textContent = Math.round(item.rotation || 0) + '°';
    }

    /* ---------- Перетаскивание внутри открытки ---------- */
    let dragState = null;

    function onPointerDown(e, item, el) {
      // не начинаем drag по элементам управления
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      dragState = {
        item, el,
        startX: e.clientX,
        startY: e.clientY,
        startItemX: item.x,
        startItemY: item.y,
        rect,
        moved: false,
      };
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      el.classList.add('sticker-item--dragging');
    }

    function onPointerMove(e) {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
      dragState.item.x = clamp(dragState.startItemX + (dx / dragState.rect.width) * 100, 2, 98);
      dragState.item.y = clamp(dragState.startItemY + (dy / dragState.rect.height) * 100, 2, 98);
      dragState.el.style.left = dragState.item.x + '%';
      dragState.el.style.top = dragState.item.y + '%';
    }

    function onPointerUp(e) {
      if (!dragState) return;
      try { dragState.el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      dragState.el.classList.remove('sticker-item--dragging');
      if (dragState.moved) saveStickers(placed);
      activeId = dragState.item.id;
      renderAll();
      dragState = null;
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    /* ---------- Drag из палитры ---------- */
    palette.querySelectorAll('[data-sticker]').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/sticker', el.getAttribute('data-sticker'));
        e.dataTransfer.effectAllowed = 'copy';
      });
    });

    /* ---------- Drop на открытку ---------- */
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      canvas.classList.add('stickers-canvas--over');
    });
    canvas.addEventListener('dragleave', () => canvas.classList.remove('stickers-canvas--over'));

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      canvas.classList.remove('stickers-canvas--over');
      const rect = canvas.getBoundingClientRect();
      const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 2, 98);
      const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 2, 98);

      const emoji = e.dataTransfer.getData('text/sticker');
      if (emoji) {
        placed.push({ id: genId(), type: 'emoji', content: emoji, x, y, scale: 1, rotation: 0 });
        saveStickers(placed);
        renderAll();
        return;
      }
      const text = e.dataTransfer.getData('text/plain');
      if (text && text.trim()) {
        placed.push({ id: genId(), type: 'text', content: text.trim(), x, y, scale: 1, rotation: 0 });
        saveStickers(placed);
        renderAll();
      }
    });

    /* ---------- Текст: превью-перетаскивание ---------- */
    if (textInput && addTextBtn) {
      const preview = document.createElement('div');
      preview.className = 'text-drag-preview';
      preview.draggable = true;
      textInput.insertAdjacentElement('afterend', preview);

      function updatePreview() {
        const v = textInput.value.trim();
        preview.textContent = v || 'Введите текст и перетащите на открытку';
        preview.classList.toggle('text-drag-preview--empty', !v);
      }
      textInput.addEventListener('input', updatePreview);
      updatePreview();

      preview.addEventListener('dragstart', (e) => {
        const v = textInput.value.trim();
        if (!v) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', v);
        e.dataTransfer.effectAllowed = 'copy';
      });

      addTextBtn.addEventListener('click', () => {
        const v = textInput.value.trim();
        if (!v) { window.showToast?.('Введите текст'); return; }
        placed.push({ id: genId(), type: 'text', content: v, x: 50, y: 50, scale: 1, rotation: 0 });
        saveStickers(placed);
        renderAll();
        textInput.value = '';
        updatePreview();
      });
    }

    /* ---------- Панель управления активным элементом ---------- */
    if (scaleRange) {
      scaleRange.addEventListener('input', () => {
        const item = placed.find((i) => i.id === activeId);
        if (!item) return;
        item.scale = parseFloat(scaleRange.value) || 1;
        saveStickers(placed);
        const el = canvas.querySelector(`[data-id="${activeId}"]`);
        if (el) el.style.transform =
          `translate(-50%, -50%) rotate(${item.rotation || 0}deg) scale(${item.scale})`;
        if (scaleValue) scaleValue.textContent = item.scale.toFixed(1);
      });
    }

    if (rotateRange) {
      rotateRange.addEventListener('input', () => {
        const item = placed.find((i) => i.id === activeId);
        if (!item) return;
        item.rotation = parseFloat(rotateRange.value) || 0;
        saveStickers(placed);
        const el = canvas.querySelector(`[data-id="${activeId}"]`);
        if (el) el.style.transform =
          `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale || 1})`;
        if (rotateValue) rotateValue.textContent = Math.round(item.rotation) + '°';
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (!activeId) return;
        placed = placed.filter((i) => i.id !== activeId);
        activeId = null;
        saveStickers(placed);
        renderAll();
      });
    }

    /* ---------- Очистка ---------- */
    document.querySelector('[data-stickers-clear]')?.addEventListener('click', () => {
      placed = [];
      activeId = null;
      saveStickers(placed);
      renderAll();
    });

    /* ---------- Клик по пустому месту — снять выделение ---------- */
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas || e.target.classList.contains('stickers-placeholder')) {
        if (activeId) { activeId = null; renderAll(); }
      }
    });

    renderAll();

    /* ---------- API для cart.js ---------- */
    window.getOrderStickers = () => loadStickers();
    window.clearOrderStickers = () => {
      placed = [];
      activeId = null;
      localStorage.removeItem(STICKERS_KEY);
      renderAll();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();