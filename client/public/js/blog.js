/**
 * blog.js — список статей (blog.html) и одна статья (blog-post.html).
 * Читает из /api/posts, при недоступности — из localStorage.mock_posts или MOCK_POSTS.
 */

const MOCK_POSTS = [
  {
    id: 1,
    title: 'Как выбрать зерно для дома',
    excerpt: 'Разбираемся в сортах, обжарке и помоле — без снобизма и лишних слов.',
    cover_url: 'https://picsum.photos/seed/beans/1200/600',
    body: 'Хороший кофе начинается с зерна. Светлая обжарка сохраняет кислотность и фруктовые ноты, тёмная — даёт плотность и горечь. Для фильтра берите светлую, для эспрессо — среднюю или тёмную.\n\nПомол важнее, чем кажется: слишком крупный — водянистый вкус, слишком мелкий — горечь. Начните с рекомендованного для вашего способа и подстраивайте.',
    created_at: '2025-10-12',
    author: 'Степан',
  },
  {
    id: 2,
    title: 'Почему латте-арт — это не главное',
    excerpt: 'Немного о том, что важнее красивой пенки.',
    cover_url: 'https://picsum.photos/seed/latteart/1200/600',
    body: 'Красивая пенка — приятный бонус, но главное в чашке — баланс. Хороший латте — это правильно экстрагированный эспрессо и молоко, взбитое до микропены.\n\nМикропена — это молоко, взбитое так, что пузырьки почти неразличимы. Именно она даёт плотную текстуру и сладость без сахара.',
    created_at: '2025-10-05',
    author: 'Степан',
  },
  {
    id: 3,
    title: 'Кофе и еда: что с чем сочетается',
    excerpt: 'Простые правила, которые улучшат ваш завтрак.',
    cover_url: 'https://picsum.photos/seed/coffeefood/1200/600',
    body: 'Кислотные сорта (Кения, Эфиопия) хорошо сочетаются с фруктами и ягодами. Шоколадные и ореховые ноты (Бразилия, Колумбия) — с выпечкой и десертами.\n\nНе бойтесь экспериментировать: главное — не перебивать вкус кофе сладким.',
    created_at: '2025-09-28',
    author: 'Степан',
  },
];

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
      const list = Array.isArray(data) ? data : (data.posts || []);
      if (list.length) return list;
    } catch { /* fallthrough */ }
    const local = localStorage.getItem('mock_posts');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch { /* ignore */ }
    }
    return MOCK_POSTS;
  }

  async function loadPost(id) {
    try {
      const data = await window.api.get(`/posts/${id}`);
      return data.post || data;
    } catch { /* fallthrough */ }
    const posts = await loadPosts();
    return posts.find((p) => String(p.id) === String(id)) || null;
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
            <span class="blog-card__meta">${formatDate(p.created_at)} · ${escapeHtml(p.author || '')}</span>
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