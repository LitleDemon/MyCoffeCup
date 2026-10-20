const pool = require('../config/db');

const ALLOWED_CATEGORIES = ['coffee', 'tea', 'dessert'];

/**
 * Список товаров с фильтрами.
 * @param {{ category?: string, search?: string }} opts
 */
async function getAll({ category, search } = {}) {
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

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT id, name, category, price, stock, description, image_url, created_at
       FROM products
       ${where}
       ORDER BY id ASC`,
    params
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, category, price, stock, description, image_url, created_at
       FROM products
      WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO products (name, category, price, stock, description, image_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.category,
      data.price,
      data.stock ?? 0,
      data.description ?? null,
      data.image_url ?? null,
    ]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  const fields = [];
  const params = [];

  ['name', 'category', 'price', 'stock', 'description', 'image_url'].forEach((key) => {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  });

  if (!fields.length) return getById(id);

  params.push(id);
  await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove, ALLOWED_CATEGORIES };