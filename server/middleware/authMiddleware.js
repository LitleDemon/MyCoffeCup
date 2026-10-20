const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

/**
 * requireAuth — строгая проверка: без валидного токена 401.
 * Подгружает пользователя из БД в req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Требуется авторизация' });
    }

    const token = header.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Токен недействителен или истёк' });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * optionalAuth — мягкая проверка: если есть Bearer, подгружает пользователя,
 * если нет или токен битый — пропускает с req.user = null.
 * Используется там, где авторизация желательна, но не обязательна
 * (например, создание заказа гостем).
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = header.slice('Bearer '.length).trim();
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(payload.sub);
  } catch {
    req.user = null;
  }
  next();
}

/**
 * requireAdmin — проверка роли. Должен идти после requireAuth.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Требуется роль администратора' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };