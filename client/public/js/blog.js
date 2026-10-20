/**
 * blog.js — список статей и страница статьи.
 * Источник данных — только API (/api/posts). Моков нет.
 * Если в БД пусто — на странице пусто.
 */

(function () {
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function loadPosts() {
    try {
      const data = await window.api.get('/posts');
      // Успешный ответ — доверяем ему, даже если пусто
      return Array.isArray(data) ? data : (data.posts || []);
    } catch (err) {
      console.warn('Не удалось загрузить статьи:', err.message);
      return [];
    }
  }

  async function loadPost(id) {
    try {
      const data = await window.api.get(`/posts/${id}`);
      return data.post || data;
    } catch (err) {
      console.warn(`Статья #${id} не загружена:`, err.message);
      return null;
    }
  }

  /* ---------- Список статей ---------- */
  async function initList() {
    const container = document.querySelector('[data-blog-list]');
    if (!container) return;

    const posts = await loadPosts();
    if (!posts.length) {
      container.innerHTML = '<p class="text-muted">Пока нет статей.</p>';
      return;
    }

    container.innerHTML = posts
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((p) => `
        <article class="blog-card">
          <a class="blog-card__media" href="/blog-post.html?id=${p.id}">
            <img src="${p.cover_url || ''}" alt="${escapeHtml(p.title)}" loading="lazy">
          </a>
          <div class="blog-card__body">
            <span class="blog-card__meta">${formatDate(p.created_at)}${p.author ? ' · ' + escapeHtml(p.author) : ''}</span>
            <h3 class="blog-card__title">
              <a href="/blog-post.html?id=${p.id}" style="color: inherit;">${escapeHtml(p.title)}</a>
            </h3>
            <p class="blog-card__excerpt">${escapeHtml(p.excerpt || '')}</p>
            <a href="/blog-post.html?id=${p.id}">Читать →</a>
          </div>
        </article>
      `).join('');
  }

  /* ---------- Одна статья ---------- */
  async function initPost() {
    const container = document.querySelector('[data-post]');
    if (!container) return;

    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
      container.innerHTML = '<p class="text-muted">Статья не найдена. <a href="/blog.html">К списку</a></p>';
      return;
    }

    const post = await loadPost(id);
    if (!post) {
      container.innerHTML = '<p class="text-muted">Статья не найдена. <a href="/blog.html">К списку</a></p>';
      return;
    }

    const paragraphs = String(post.body || '')
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join('');

    document.title = `${post.title} — MyCoffeCup`;

    container.innerHTML = `
      <a href="/blog.html" class="text-muted">← Все статьи</a>
      <header style="margin: var(--sp-4) 0 var(--sp-5);">
        <span class="badge badge--accent">${formatDate(post.created_at)}</span>
        <h1 style="margin-top: var(--sp-2);">${escapeHtml(post.title)}</h1>
        <p class="text-muted">Автор: ${escapeHtml(post.author || 'MyCoffeCup')}</p>
      </header>
      ${post.cover_url ? `<img src="${post.cover_url}" alt="" style="width: 100%; border-radius: var(--radius-lg); margin-bottom: var(--sp-5);">` : ''}
      <div class="article">${paragraphs}</div>
    `;
  }

  function init() {
    initList();
    initPost();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();