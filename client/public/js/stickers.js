/**
 * stickers.js — drag-and-drop стикеры + текстовые элементы на открытке.
 *
 * Управление динамическое: маркеры прямо на стикере.
 * - Справа по центру — ресайз (тянем от центра)
 * - Правый верхний угол — поворот
 * - Левый верхний угол — удалить
 *
 * Данные хранятся в localStorage.stickers.
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
  function normalizeRotation(r) { return ((r % 360) + 360) % 360; }

  function init() {
    const canvas = document.querySelector('[data-stickers-canvas]');
    const palette = document.querySelector('[data-stickers-palette]');
    if (!canvas || !palette) return;

    const textInput = document.querySelector('[data-stickers-text]');
    const addTextBtn = document.querySelector('[data-stickers-add-text]');

    let placed = loadStickers();
    let activeId = null;
    let dragState = null;

    /* ---------- Палитра ---------- */
    palette.innerHTML = STICKERS.map((s) =>
      `<span class="sticker-chip" draggable="true" data-sticker="${s}">${s}</span>`
    ).join('');

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
        el.style.setProperty('--s', item.scale || 1);
        el.style.setProperty('--r', (item.rotation || 0) + 'deg');

        el.innerHTML = `
          <div class="sticker-content">${item.content}</div>
          <button type="button" class="sticker-handle sticker-handle--resize"
                  data-handle="resize" aria-label="Изменить размер">
            <span class="sticker-handle__icon">↔</span>
          </button>
          <button type="button" class="sticker-handle sticker-handle--rotate"
                  data-handle="rotate" aria-label="Повернуть">
            <span class="sticker-handle__icon">↻</span>
          </button>
          <button type="button" class="sticker-handle sticker-handle--delete"
                  data-handle="delete" aria-label="Удалить">✕</button>
        `;

        el.addEventListener('pointerdown', (e) => onStickerPointerDown(e, item, el));

        el.querySelector('[data-handle="resize"]').addEventListener('pointerdown',
          (e) => startResize(e, item, el));
        el.querySelector('[data-handle="rotate"]').addEventListener('pointerdown',
          (e) => startRotate(e, item, el));
        el.querySelector('[data-handle="delete"]').addEventListener('click', (e) => {
          e.stopPropagation();
          placed = placed.filter((i) => i.id !== item.id);
          activeId = null;
          saveStickers(placed);
          renderAll();
        });

        canvas.appendChild(el);
      });
    }

    /* ---------- Перетаскивание и активация ---------- */
    function onStickerPointerDown(e, item, el) {
      if (e.target.closest('.sticker-handle')) return;
      e.preventDefault();
      e.stopPropagation();

      // Активируем без пересоздания DOM
      if (activeId !== item.id) {
        activeId = item.id;
        canvas.querySelectorAll('.sticker-item').forEach((x) => {
          x.classList.toggle('sticker-item--active', x.dataset.id === item.id);
        });
      }

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
      try { el.setPointerCapture(e.pointerId); } catch {}
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
      try { dragState.el.releasePointerCapture(e.pointerId); } catch {}
      dragState.el.classList.remove('sticker-item--dragging');
      if (dragState.moved) saveStickers(placed);
      dragState = null;
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    /* ---------- Ресайз ---------- */
    function startResize(e, item, el) {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + (item.x / 100) * rect.width;
      const cy = rect.top + (item.y / 100) * rect.height;
      const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
      const startScale = item.scale || 1;

      function onMove(ev) {
        const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        item.scale = clamp(startScale * (dist / startDist), 0.3, 4);
        el.style.setProperty('--s', item.scale);
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        saveStickers(placed);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    }

    /* ---------- Поворот ---------- */
    function startRotate(e, item, el) {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + (item.x / 100) * rect.width;
      const cy = rect.top + (item.y / 100) * rect.height;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
      const startRotation = item.rotation || 0;

      function onMove(ev) {
        const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
        const deltaDeg = (angle - startAngle) * 180 / Math.PI;
        item.rotation = normalizeRotation(startRotation + deltaDeg);
        el.style.setProperty('--r', item.rotation + 'deg');
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        saveStickers(placed);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    }

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

    /* ---------- Текст ---------- */
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

    /* ---------- API для checkout ---------- */
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