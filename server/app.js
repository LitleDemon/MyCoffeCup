require('dotenv').config();

const express = require('express');
const path = require('path');

const productRoutes = require('./routes/productRoutes');
const authRoutes    = require('./routes/authRoutes');
const orderRoutes   = require('./routes/orderRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const blogRoutes = require('./routes/blogRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- Парсеры тела ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------- Логирование API ---------- */
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

/* ---------- API ---------- */
app.use('/api/products', productRoutes);
app.use('/api/auth',     authRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/posts', blogRoutes);


/* ---------- 404 для API ---------- */
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API-метод не найден' });
});

/* ---------- Статика ---------- */
app.use(express.static(path.join(__dirname, '..', 'client', 'public')));

/* ---------- Общий обработчик ошибок ---------- */
app.use((err, req, res, next) => {
  console.error('Ошибка:', err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Внутренняя ошибка сервера',
  });
});

/* ---------- Запуск ---------- */
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Сервер запущен');
  console.log('─────────────────────────────────────');
  console.log(`🏠 Главная:    http://localhost:${PORT}/`);
  console.log(`🔐 Вход:       http://localhost:${PORT}/login.html`);
  console.log(`📊 Админка:    http://localhost:${PORT}/admin/dashboard.html`);
  console.log('─────────────────────────────────────');
  console.log(`🔌 API:        http://localhost:${PORT}/api/products`);
  console.log(`🔌 Auth:       http://localhost:${PORT}/api/auth/login`);
  console.log(`🔌 Orders:     http://localhost:${PORT}/api/orders`);
  console.log(`🔌 Stats:      http://localhost:${PORT}/api/admin/stats`);
  console.log(`🔌 Blog:       http://localhost:${PORT}/api/posts`);
  console.log('');
});