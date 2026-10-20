const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

/* ---------- POST /api/auth/register ---------- */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body || {};
    const errors = [];

    if (!name || String(name).trim().length < 2) {
      errors.push('name — минимум 2 символа');
    }
    if (!email || !isEmailValid(email)) {
      errors.push('email — некорректный адрес');
    }
    if (!password || String(password).length < 6) {
      errors.push('password — минимум 6 символов');
    }

    if (errors.length) {
      return res.status(400).json({ message: 'Ошибка валидации', errors });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await User.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const created = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'user',
    });

    const token = signToken(created);
    res.status(201).json({ token, user: publicUser(created) });
  } catch (err) {
    next(err);
  }
}

/* ---------- POST /api/auth/login ---------- */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Укажите email и пароль' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/* ---------- GET /api/auth/me ---------- */
async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };