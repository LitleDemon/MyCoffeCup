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
  price       DECIMAL(10,2) NOT NULL,          -- базовая цена (минимальный размер или фикс)
  description TEXT,
  image_url   VARCHAR(500),
  sizes       JSON NULL,                       -- [{"code":"S","price":250},{"code":"M","price":280}] — null для десертов
  is_seasonal BOOLEAN NOT NULL DEFAULT FALSE,  -- сезонный напиток
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_category (category),
  INDEX idx_products_seasonal (is_seasonal)
) ENGINE=InnoDB;

-- ---------- Топпинги и сиропы ----------
CREATE TABLE IF NOT EXISTS toppings (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  type        ENUM('syrup','topping') NOT NULL DEFAULT 'syrup',
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_seasonal BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  DATE NULL,                       -- для сезонных: дата, после которой исчезает из пользовательского вида
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_toppings_active (is_active),
  INDEX idx_toppings_seasonal (is_seasonal)
) ENGINE=InnoDB;

-- ---------- Заказы ----------
CREATE TABLE IF NOT EXISTS orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NULL,
  customer_name  VARCHAR(150) NOT NULL DEFAULT 'Гость',
  customer_email VARCHAR(150) NULL,
  total          DECIMAL(10,2) NOT NULL DEFAULT 0,
  status         ENUM('new','paid','done','cancelled') NOT NULL DEFAULT 'new',
  payment_method ENUM('online','onsite') NOT NULL DEFAULT 'onsite',
  paid_at        DATETIME NULL,
  stickers       JSON NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_orders_status  (status),
  INDEX idx_orders_created (created_at),
  INDEX idx_orders_user    (user_id)
) ENGINE=InnoDB;

-- ---------- Позиции заказа ----------
CREATE TABLE IF NOT EXISTS order_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  product_id INT NULL,
  name       VARCHAR(150) NOT NULL,
  price      DECIMAL(10,2) NOT NULL,           -- итоговая цена за единицу (размер + топпинги)
  qty        INT NOT NULL,
  options    JSON NULL,                        -- {"size":"M","base":280,"toppings":[{"id":1,"name":"Карамель","price":30}]}
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
-- Тестовые данные
-- =========================================================

INSERT INTO products (name, category, price, description, image_url, sizes, is_seasonal) VALUES
('Эспрессо',        'coffee',  150.00, 'Классический крепкий эспрессо.',           'https://picsum.photos/seed/espresso/600/450',  JSON_ARRAY(JSON_OBJECT('code','S','price',150), JSON_OBJECT('code','M','price',180)), FALSE),
('Американо',       'coffee',  180.00, 'Эспрессо с горячей водой.',                'https://picsum.photos/seed/americano/600/450', JSON_ARRAY(JSON_OBJECT('code','S','price',180), JSON_OBJECT('code','M','price',210), JSON_OBJECT('code','L','price',240)), FALSE),
('Латте',           'coffee',  280.00, 'Эспрессо с подогретым молоком.',           'https://picsum.photos/seed/latte/600/450',     JSON_ARRAY(JSON_OBJECT('code','S','price',250), JSON_OBJECT('code','M','price',280), JSON_OBJECT('code','L','price',310)), FALSE),
('Капучино',        'coffee',  260.00, 'Эспрессо и вспененное молоко.',            'https://picsum.photos/seed/cappuccino/600/450',JSON_ARRAY(JSON_OBJECT('code','S','price',230), JSON_OBJECT('code','M','price',260), JSON_OBJECT('code','L','price',290)), FALSE),
('Тыквенный латте', 'coffee',  320.00, 'Сезонный латте с тыквой и специями.',      'https://picsum.photos/seed/pumpkin/600/450',   JSON_ARRAY(JSON_OBJECT('code','S','price',290), JSON_OBJECT('code','M','price',320), JSON_OBJECT('code','L','price',350)), TRUE),
('Матча-латте',     'tea',     320.00, 'Японский зелёный чай матча с молоком.',    'https://picsum.photos/seed/matcha/600/450',    JSON_ARRAY(JSON_OBJECT('code','S','price',290), JSON_OBJECT('code','M','price',320), JSON_OBJECT('code','L','price',350)), FALSE),
('Облепиховый чай', 'tea',     240.00, 'Согревающий чай с облепихой и мёдом.',     'https://picsum.photos/seed/teaberry/600/450',  JSON_ARRAY(JSON_OBJECT('code','S','price',220), JSON_OBJECT('code','M','price',240)), FALSE),
('Круассан',        'dessert', 180.00, 'Классический французский круассан.',       'https://picsum.photos/seed/croissant/600/450', NULL, FALSE),
('Чизкейк',         'dessert', 320.00, 'Нежный чизкейк с ягодным соусом.',         'https://picsum.photos/seed/cheesecake/600/450',NULL, FALSE);

INSERT INTO toppings (name, type, price, is_active, is_seasonal, expires_at) VALUES
('Карамельный сироп', 'syrup',   30.00, TRUE, FALSE, NULL),
('Ванильный сироп',   'syrup',   30.00, TRUE, FALSE, NULL),
('Лавандовый сироп',  'syrup',   40.00, TRUE, FALSE, NULL),
('Сироп солёная карамель', 'syrup', 45.00, TRUE, TRUE, '2026-12-31'),
('Маршмеллоу',        'topping', 50.00, TRUE, FALSE, NULL),
('Взбитые сливки',    'topping', 40.00, TRUE, FALSE, NULL),
('Корица',            'topping', 20.00, TRUE, FALSE, NULL),
('Тыквенная посыпка', 'topping', 60.00, TRUE, TRUE, '2026-12-31');

INSERT INTO posts (title, excerpt, body, cover_url) VALUES
('Как выбрать зерно для дома', 'Разбираемся в сортах, обжарке и помоле.',
 'Хороший кофе начинается с зерна. Светлая обжарка сохраняет кислотность и фруктовые ноты, тёмная — даёт плотность и горечь.\n\nПомол важнее, чем кажется: слишком крупный — водянистый вкус, слишком мелкий — горечь.',
 'https://picsum.photos/seed/beans/1200/600'),
('Почему латте-арт — это не главное', 'Немного о том, что важнее красивой пенки.',
 'Красивая пенка — приятный бонус, но главное в чашке — баланс.\n\nМикропена — это молоко, взбитое так, что пузырьки почти неразличимы. Именно она даёт плотную текстуру и сладость без сахара.',
 'https://picsum.photos/seed/latteart/1200/600');