const Product = require('../models/productModel');

/* ---------- Валидация ---------- */
function validateProductPayload(body, { partial = false } = {}) {
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
    if (isNaN(price) || price < 0) {
      errors.push('price — неотрицательное число');
    }
  }

  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      errors.push('stock — целое неотрицательное число');
    }
  }

  return errors;
}

function sanitize(body) {
  return {
    name: body.name?.trim(),
    category: body.category,
    price: body.price !== undefined ? Number(body.price) : undefined,
    stock: body.stock !== undefined ? Number(body.stock) : undefined,
    description: body.description?.trim() ?? undefined,
    image_url: body.image_url?.trim() ?? undefined,
  };
}

/* ---------- GET /api/products ---------- */
async function list(req, res, next) {
  try {
    const products = await Product.getAll({
      category: req.query.category,
      search: req.query.search,
    });
    res.json({ products, count: products.length });
  } catch (err) {
    next(err);
  }
}

/* ---------- GET /api/products/:id ---------- */
async function getOne(req, res, next) {
  try {
    const product = await Product.getById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

/* ---------- POST /api/products (admin) ---------- */
async function create(req, res, next) {
  try {
    const errors = validateProductPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: 'Ошибка валидации', errors });
    }
    const product = await Product.create(sanitize(req.body));
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

/* ---------- PUT /api/products/:id (admin) ---------- */
async function update(req, res, next) {
  try {
    const existing = await Product.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Товар не найден' });
    }

    const errors = validateProductPayload(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ message: 'Ошибка валидации', errors });
    }

    const product = await Product.update(req.params.id, sanitize(req.body));
    res.json(product);
  } catch (err) {
    next(err);
  }
}

/* ---------- DELETE /api/products/:id (admin) ---------- */
async function remove(req, res, next) {
  try {
    const removed = await Product.remove(req.params.id);
    if (!removed) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    res.json({ success: true, id: Number(req.params.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };