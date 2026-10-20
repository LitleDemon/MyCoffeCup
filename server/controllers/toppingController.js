const Topping = require('../models/toppingModel');

const ALLOWED_TYPES = ['syrup', 'topping'];

function validate(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) errors.push('name — обязательное поле');
  }
  if (!partial || body.type !== undefined) {
    if (!ALLOWED_TYPES.includes(body.type)) errors.push(`type — одно из: ${ALLOWED_TYPES.join(', ')}`);
  }
  if (!partial || body.price !== undefined) {
    const p = Number(body.price);
    if (isNaN(p) || p < 0) errors.push('price — неотрицательное число');
  }
  return errors;
}

function sanitize(body) {
  return {
    name: body.name?.trim(),
    type: body.type,
    price: body.price !== undefined ? Number(body.price) : undefined,
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined,
    is_seasonal: body.is_seasonal !== undefined ? Boolean(body.is_seasonal) : undefined,
    expires_at: body.expires_at !== undefined ? (body.expires_at || null) : undefined,
  };
}

async function listPublic(req, res, next) {
  try { res.json({ toppings: await Topping.getActive() }); }
  catch (err) { next(err); }
}
async function listAdmin(req, res, next) {
  try { res.json({ toppings: await Topping.getAll() }); }
  catch (err) { next(err); }
}
async function create(req, res, next) {
  try {
    const errors = validate(req.body || {});
    if (errors.length) return res.status(400).json({ message: 'Ошибка валидации', errors });
    res.status(201).json(await Topping.create(sanitize(req.body)));
  } catch (err) { next(err); }
}
async function update(req, res, next) {
  try {
    const existing = await Topping.getById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Топпинг не найден' });
    const errors = validate(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ message: 'Ошибка валидации', errors });
    res.json(await Topping.update(req.params.id, sanitize(req.body)));
  } catch (err) { next(err); }
}
async function remove(req, res, next) {
  try {
    const ok = await Topping.remove(req.params.id);
    if (!ok) return res.status(404).json({ message: 'Топпинг не найден' });
    res.json({ success: true, id: Number(req.params.id) });
  } catch (err) { next(err); }
}

module.exports = { listPublic, listAdmin, create, update, remove };