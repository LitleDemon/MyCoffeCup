const Post = require('../models/postModel');

function validatePayload(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.title !== undefined) {
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      errors.push('title — обязательное поле');
    }
  }
  if (!partial || body.body !== undefined) {
    if (!body.body || typeof body.body !== 'string' || !body.body.trim()) {
      errors.push('body — обязательное поле');
    }
  }
  if (body.excerpt !== undefined && body.excerpt !== null && String(body.excerpt).length > 300) {
    errors.push('excerpt — максимум 300 символов');
  }

  return errors;
}

function sanitize(body) {
  return {
    title: body.title?.trim(),
    excerpt: body.excerpt !== undefined ? String(body.excerpt).trim() : undefined,
    body: body.body?.trim(),
    cover_url: body.cover_url !== undefined ? String(body.cover_url).trim() : undefined,
  };
}

/* ---------- GET /api/posts ---------- */
async function list(req, res, next) {
  try {
    const posts = await Post.getAll();
    res.json({ posts, count: posts.length });
  } catch (err) {
    next(err);
  }
}

/* ---------- GET /api/posts/:id ---------- */
async function getOne(req, res, next) {
  try {
    const post = await Post.getById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Статья не найдена' });
    res.json(post);
  } catch (err) {
    next(err);
  }
}

/* ---------- POST /api/posts (admin) ---------- */
async function create(req, res, next) {
  try {
    const errors = validatePayload(req.body || {});
    if (errors.length) {
      return res.status(400).json({ message: 'Ошибка валидации', errors });
    }

    const data = sanitize(req.body);
    data.author_id = req.user?.id || null;

    const post = await Post.create(data);
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
}

/* ---------- PUT /api/posts/:id (admin) ---------- */
async function update(req, res, next) {
  try {
    const existing = await Post.getById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Статья не найдена' });

    const errors = validatePayload(req.body || {}, { partial: true });
    if (errors.length) {
      return res.status(400).json({ message: 'Ошибка валидации', errors });
    }

    const post = await Post.update(req.params.id, sanitize(req.body));
    res.json(post);
  } catch (err) {
    next(err);
  }
}

/* ---------- DELETE /api/posts/:id (admin) ---------- */
async function remove(req, res, next) {
  try {
    const removed = await Post.remove(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Статья не найдена' });
    res.json({ success: true, id: Number(req.params.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };