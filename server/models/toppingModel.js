const pool = require('../config/db');

/* Публичный список: активные + не истёкшие по дате */
async function getActive() {
  const [rows] = await pool.query(`
    SELECT id, name, type, price, is_active, is_seasonal, expires_at
    FROM toppings
    WHERE is_active = TRUE
      AND (is_seasonal = FALSE OR expires_at IS NULL OR expires_at >= CURDATE())
    ORDER BY is_seasonal DESC, type ASC, name ASC
  `);
  return rows.map(normalize);
}

/* Админский список: все, включая отключённые и истёкшие */
async function getAll() {
  const [rows] = await pool.query(`
    SELECT id, name, type, price, is_active, is_seasonal, expires_at, created_at
    FROM toppings
    ORDER BY is_active DESC, is_seasonal DESC, name ASC
  `);
  return rows.map(normalize);
}

async function getById(id) {
  const [rows] = await pool.query(
    'SELECT id, name, type, price, is_active, is_seasonal, expires_at FROM toppings WHERE id = ?',
    [id]
  );
  return rows[0] ? normalize(rows[0]) : null;
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO toppings (name, type, price, is_active, is_seasonal, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.name, data.type, data.price, data.is_active ? 1 : 0, data.is_seasonal ? 1 : 0, data.expires_at || null]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  const fields = [];
  const params = [];
  ['name', 'type', 'price', 'expires_at'].forEach((key) => {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  });
  if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  if (data.is_seasonal !== undefined) { fields.push('is_seasonal = ?'); params.push(data.is_seasonal ? 1 : 0); }

  if (!fields.length) return getById(id);
  params.push(id);
  await pool.query(`UPDATE toppings SET ${fields.join(', ')} WHERE id = ?`, params);
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM toppings WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

function normalize(t) {
  if (!t) return null;
  t.is_active = Boolean(t.is_active);
  t.is_seasonal = Boolean(t.is_seasonal);
  if (t.expires_at instanceof Date) t.expires_at = t.expires_at.toISOString().slice(0, 10);
  return t;
}

module.exports = { getActive, getAll, getById, create, update, remove };