/**
 * seed.js — создаёт тестовых пользователей.
 * Запуск: node server/seed.js
 * Демо-аккаунты после сида:
 *   admin@coffee.ru / admin123  (роль admin)
 *   user@coffee.ru  / user123   (роль user)
 */

const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function upsertUser(name, email, password, role) {
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (rows.length) {
    console.log(`≈ уже существует: ${email}`);
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, hash, role]
  );
  console.log(`✓ создан ${role}: ${email} / ${password}`);
}

async function main() {
  await upsertUser('Администратор', 'admin@coffee.ru', 'admin123', 'admin');
  await upsertUser('Степан',        'user@coffee.ru',  'user123',  'user');
  await pool.end();
  console.log('Готово.');
}

main().catch((err) => {
  console.error('Ошибка сида:', err.message);
  process.exit(1);
});