const pool = require('../config/db');

/* Общий SELECT с JOIN автора */
const SELECT_FIELDS = `
  p.id, p.title, p.excerpt, p.body, p.cover_url,
  u.name AS author, p.created_at, p.updated_at
`;
const FROM_JOIN = `
  FROM posts p
  LEFT JOIN users u ON u.id = p.author_id
`;

async function getAll() {
  const [rows] = await pool.query(`
    SELECT ${SELECT_FIELDS}
    ${FROM_JOIN}
    ORDER BY p.created_at DESC
  `);
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS} ${FROM_JOIN} WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function create({ title, excerpt, body, cover_url, author_id }) {
  const [result] = await pool.query(
    `INSERT INTO posts (title, excerpt, body, cover_url, author_id)
     VALUES (?, ?, ?, ?, ?)`,
    [title, excerpt || null, body, cover_url || null, author_id || null]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  const fields = [];
  const params = [];

  ['title', 'excerpt', 'body', 'cover_url'].forEach((key) => {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  });

  if (!fields.length) return getById(id);

  params.push(id);
  await pool.query(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`, params);
  return getById(id);
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM posts WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { getAll, getById, create, update, remove };