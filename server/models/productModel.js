const pool = require('../config/db');

const ALLOWED_CATEGORIES = ['coffee', 'tea', 'dessert'];

/* Публичный SELECT с сортировкой: сезонные сверху */
async function getAll({ category, search, seasonalOnly } = {}) {
  const conditions = [];
  const params = [];

  if (category && ALLOWED_CATEGORIES.includes(category)) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (search) {
    conditions.push('name LIKE ?');
    params.push(`%${search}%`);
  }
  if (seasonalOnly) {
    conditions.push('is_seasonal = TRUE');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT id, name, category, price, description, image_url, sizes, is_seasonal, created_at
       FROM products
       ${where}
       ORDER BY is_seasonal DESC, id ASC`,
    params
  );
  return rows.map(normalize);
}

async function getById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, category, price, description, image_url, sizes, is_seasonal, created_at
       FROM products WHERE id = ?`,
    [id]
  );
  return rows[0] ? normalize(rows[0]) : null;
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO products (name, category, price, description, image_url, sizes, is_seasonal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.category,
      data.price,
      data.description ?? null,
      data.image_url ?? null,
      data.sizes ? JSON.stringify(data.sizes) : null,
      data.is_seasonal ? 1 : 0,
    ]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  const fields = [];
  const params = [];

  ['name', 'category', 'price', 'description', 'image_url'].forEach((key) => {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  });

  if (data.sizes !== undefined) {
    fields.push('sizes = ?');
    params.push(data.sizes ? JSON.stringify(data.sizes) : null);
  }
  if (data.is_seasonal !== undefined) {
    fields.push('is_seasonal = ?');
    params.push(data.is_seasonal ? 1 : 0);
  }

  if (!fields.length) return getById(id);

  params.push(id);
  await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/* JSON из mysql2 иногда приходит строкой, иногда объектом */
function normalize(p) {
  if (!p) return null;
  if (typeof p.sizes === 'string') {
    try { p.sizes = JSON.parse(p.sizes); } catch { p.sizes = null; }
  }
  p.is_seasonal = Boolean(p.is_seasonal);
  return p;
}

module.exports = { getAll, getById, create, update, remove, ALLOWED_CATEGORIES };