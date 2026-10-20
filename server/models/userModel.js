const pool = require('../config/db');

/* Публичные поля — без password_hash */
const PUBLIC_FIELDS = 'id, name, email, role, created_at';

async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_FIELDS}, password_hash FROM users WHERE email = ?`,
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function create({ name, email, passwordHash, role = 'user' }) {
  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
    [name, email, passwordHash, role]
  );
  return findById(result.insertId);
}

module.exports = { findByEmail, findById, create };