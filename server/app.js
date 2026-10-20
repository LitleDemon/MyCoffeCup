const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'client', 'public')));

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Сервер запущен');
  console.log('─────────────────────────────────────');
  console.log(`🏠 Главная:    http://localhost:${PORT}/`);
  console.log(`☕ Товар:      http://localhost:${PORT}/product.html`);
  console.log(`🛒 Корзина:    http://localhost:${PORT}/cart.html`);
  console.log(`📝 Блог:       http://localhost:${PORT}/blog.html`);
  console.log(`🔐 Вход:       http://localhost:${PORT}/login.html`);
  console.log('─────────────────────────────────────');
  console.log(`📊 Админка:    http://localhost:${PORT}/admin/dashboard.html`);
  console.log(`☕ Товары:     http://localhost:${PORT}/admin/products.html`);
  console.log(`📄 Контент:    http://localhost:${PORT}/admin/content.html`);
  console.log(`🧾 Заказы:     http://localhost:${PORT}/admin/orders.html`);
  console.log('─────────────────────────────────────');
  console.log('');
});