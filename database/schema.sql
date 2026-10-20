-- =========================================================
-- MyCoffeCup — схема базы данных (MySQL 5.7+ / 8+ / MariaDB 10.3+)
-- Запускается один раз на чистой базе.
-- Если нужно пересоздать — DROP DATABASE coffee_shop; и заново.
-- =========================================================
-- Принудительно работаем в UTF-8 при импорте через mysql-клиент
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS coffee_shop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE coffee_shop;

-- ---------- Пользователи ----------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Товары ----------
CREATE TABLE IF NOT EXISTS products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  category    ENUM('coffee','tea','dessert') NOT NULL DEFAULT 'coffee',
  price       DECIMAL(10,2) NOT NULL,
  stock       INT NOT NULL DEFAULT 0,
  description TEXT,
  image_url   VARCHAR(500),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_category (category)
) ENGINE=InnoDB;

-- ---------- Заказы ----------
CREATE TABLE IF NOT EXISTS orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NULL,
  customer_name  VARCHAR(150) NOT NULL DEFAULT 'Гость',
  customer_email VARCHAR(150) NULL,
  total          DECIMAL(10,2) NOT NULL DEFAULT 0,
  status         ENUM('new','paid','done','cancelled') NOT NULL DEFAULT 'new',
  stickers       JSON NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_orders_status  (status),
  INDEX idx_orders_created (created_at)
) ENGINE=InnoDB;

-- ---------- Позиции заказа ----------
CREATE TABLE IF NOT EXISTS order_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  product_id INT NULL,
  name       VARCHAR(150) NOT NULL,   -- снимок названия на момент заказа
  price      DECIMAL(10,2) NOT NULL,  -- снимок цены
  qty        INT NOT NULL,
  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Блог ----------
CREATE TABLE IF NOT EXISTS posts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  excerpt    VARCHAR(300),
  body       MEDIUMTEXT NOT NULL,
  cover_url  VARCHAR(500),
  author_id  INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_posts_created (created_at)
) ENGINE=InnoDB;

-- =========================================================
-- Тестовые данные: товары и статьи.
-- Пользователей создаёт server/seed.js (там bcrypt-хэши).
-- =========================================================

INSERT INTO products (name, category, price, stock, description, image_url) VALUES
('Эспрессо',        'coffee',  150.00, 100, 'Классический крепкий эспрессо из смеси арабики и робусты.', 'https://picsum.photos/seed/espresso/600/450'),
('Американо',       'coffee',  180.00, 100, 'Эспрессо с горячей водой. Мягкий и бодрящий.',              'https://picsum.photos/seed/americano/600/450'),
('Латте',           'coffee',  280.00,  80, 'Эспрессо с подогретым молоком и нежной пенкой.',            'https://picsum.photos/seed/latte/600/450'),
('Капучино',        'coffee',  260.00,  80, 'Эспрессо и вспененное молоко в равных пропорциях.',         'https://picsum.photos/seed/cappuccino/600/450'),
('Матча-латте',     'tea',     320.00,  50, 'Японский зелёный чай матча с молоком.',                     'https://picsum.photos/seed/matcha/600/450'),
('Облепиховый чай', 'tea',     240.00,  50, 'Согревающий чай с облепихой и мёдом.',                      'https://picsum.photos/seed/teaberry/600/450'),
('Круассан',        'dessert', 180.00,  30, 'Классический французский круассан со сливочным маслом.',    'https://picsum.photos/seed/croissant/600/450'),
('Чизкейк',         'dessert', 320.00,  20, 'Нежный чизкейк на песочной основе с ягодным соусом.',       'https://picsum.photos/seed/cheesecake/600/450');

INSERT INTO posts (title, excerpt, body, cover_url) VALUES
('Как выбрать зерно для дома',
 'Разбираемся в сортах, обжарке и помоле — без снобизма и лишних слов.',
 'Хороший кофе начинается с зерна. Светлая обжарка сохраняет кислотность и фруктовые ноты, тёмная — даёт плотность и горечь. Для фильтра берите светлую, для эспрессо — среднюю или тёмную.\n\nПомол важнее, чем кажется: слишком крупный — водянистый вкус, слишком мелкий — горечь. Начните с рекомендованного для вашего способа и подстраивайте.',
 'https://picsum.photos/seed/beans/1200/600'),
('Почему латте-арт — это не главное',
 'Немного о том, что важнее красивой пенки.',
 'Красивая пенка — приятный бонус, но главное в чашке — баланс. Хороший латте — это правильно экстрагированный эспрессо и молоко, взбитое до микропены.\n\nМикропена — это молоко, взбитое так, что пузырьки почти неразличимы. Именно она даёт плотную текстуру и сладость без сахара.',
 'https://picsum.photos/seed/latteart/1200/600'),
('Кофе и еда: что с чем сочетается',
 'Простые правила, которые улучшат ваш завтрак.',
 'Кислотные сорта (Кения, Эфиопия) хорошо сочетаются с фруктами и ягодами. Шоколадные и ореховые ноты (Бразилия, Колумбия) — с выпечкой и десертами.\n\nНе бойтесь экспериментировать: главное — не перебивать вкус кофе сладким.',
 'https://picsum.photos/seed/coffeefood/1200/600');