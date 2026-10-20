const Product = require('../models/productModel');

const ALLOWED_SIZES = ['S', 'M', 'L'];

function validatePayload(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name — обязательное поле');
    }
  }
  if (!partial || body.category !== undefined) {
    if (!Product.ALLOWED_CATEGORIES.includes(body.category)) {
      errors.push(`category — одно из: ${Product.ALLOWED_CATEGORIES.join(', ')}`);
    }
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (isNaN(price) || price < 0) errors.push('price — неотрицательное число');
  }

  if (body.sizes !== undefined && body.sizes !== null) {
    if (!Array.isArray(body.sizes)) {
      errors.push('sizes — массив или null');
    } else {
      for (const s of body.sizes) {
        if (!s || !ALLOWED_SIZES.includes(s.code)) {
          errors.push('sizes.code — одно из S/M/L');
          break;
        }
        if (isNaN(Number(s.price)) || Number(s.price) < 0) {
          errors.push('sizes.price — неотрицательное число');
          break;
        }
      }
    }
  }
  return errors;
}

function sanitize(body) {
  const out = {
    name: body.name?.trim(),
    category: body.category,
    description: body.description !== undefined ? String(body.description).trim() : undefined,
    image_url: body.image_url !== undefined ? String(body.image_url).trim() : undefined,
    is_seasonal: body.is_seasonal !== undefined ? Boolean(body.is_seasonal) : undefined,
  };

  if (body.price !== undefined) out.price = Number(body.price);

  if (body.sizes === null) {
    out.sizes = null;
  } else if (Array.isArray(body.sizes)) {
    out.sizes = body.sizes.map((s) => ({
      code: s.code,
      price: Number(s.price),
    }));
    // Если sizes переданы, базовый price = минимальная цена размера
    if (out.sizes.length && out.price === undefined) {
      out.price = Math.min(...out.sizes.map((s) => s.price));
    }
  }
  return out;
}

async function list(req, res, next) {
  try {
    const products = await Product.getAll({
      category: req.query.category,
      search: req.query.search,
      seasonalOnly: req.query.seasonal === '1' || req.query.seasonal === 'true',
    });
    res.json({ products, count: products.length });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const product = await Product.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    res.json(product);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const errors = validatePayload(req.body || {});
    if (errors.length) return res.status(400).json({ message: 'Ошибка валидации', errors });
    const product = await Product.create(sanitize(req.body));
    res.status(201).json(product);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const existing = await Product.getById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Товар не найден' });

    const errors = validatePayload(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ message: 'Ошибка валидации', errors });

    const product = await Product.update(req.params.id, sanitize(req.body));
    res.json(product);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const removed = await Product.remove(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Товар не найден' });
    res.json({ success: true, id: Number(req.params.id) });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove };