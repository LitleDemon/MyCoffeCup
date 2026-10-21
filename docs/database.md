# База данных

**СУБД:** MySQL 5.7+ / MariaDB 10.3+  
**Кодировка:** `utf8mb4` / `utf8mb4_unicode_ci`  
**Имя БД:** `coffee_shop`

Схема: [`database/schema.sql`](../database/schema.sql)

---

## 📑 Содержание

- [ER-диаграмма](#er-диаграмма)
- [Таблицы](#таблицы)
  - [users](#users--пользователи)
  - [products](#products--товары)
  - [toppings](#toppings--сиропы-и-топпинги)
  - [orders](#orders--заказы)
  - [order_items](#order_items--позиции-заказа)
  - [posts](#posts--блог)
- [Связи между таблицами](#связи-между-таблицами)
- [Тестовые данные](#тестовые-данные)
- [Особенности импорта](#особенности-импорта)

---

## ER-диаграмма

```
users ────┬──< orders ───< order_items >──── products
          │
          └──< posts

toppings (независимая таблица, ссылки хранятся в order_items.options)
```

- `orders.user_id` → `users.id` (`ON DELETE SET NULL`)
- `order_items.order_id` → `orders.id` (`ON DELETE CASCADE`)
- `order_items.product_id` → `products.id` (`ON DELETE SET NULL`)
- `posts.author_id` → `users.id` (`ON DELETE SET NULL`)
- `toppings` **не имеет** FK-связей — снимки топпингов хранятся как JSON в `order_items.options`

---

## Таблицы

### `users` — пользователи

| Поле | Тип | Описание |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Идентификатор |
| `name` | VARCHAR(100) NOT NULL | Имя |
| `email` | VARCHAR(150) NOT NULL UNIQUE | Email (логин) |
| `password_hash` | VARCHAR(255) NOT NULL | bcrypt-хэш пароля |
| `role` | ENUM('user','admin') | Роль, по умолчанию `user` |
| `created_at` | TIMESTAMP | Дата регистрации |

**Особенности:**
- `password_hash` — bcrypt с солью (10 раундов). Открытый пароль никогда не хранится.
- `email` при сохранении приводится к нижнему регистру.
- Сравнение пароля — только через `bcrypt.compare()`, никогда через `===`.

---

### `products` — товары

| Поле | Тип | Описание |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Идентификатор |
| `name` | VARCHAR(150) NOT NULL | Название |
| `category` | ENUM('coffee','tea','dessert') | Категория |
| `price` | DECIMAL(10,2) NOT NULL | Базовая цена (минимальный размер или фикс) |
| `description` | TEXT | Описание |
| `image_url` | VARCHAR(500) | URL изображения (`/uploads/...` или внешний) |
| `sizes` | JSON NULL | Массив размеров — `null` для десертов |
| `is_seasonal` | BOOLEAN | Сезонный товар (в приоритете в каталоге) |
| `created_at` | TIMESTAMP | Создан |
| `updated_at` | TIMESTAMP | Обновлён |

**Формат `sizes`:**
```json
[
  { "code": "S", "price": 250 },
  { "code": "M", "price": 280 },
  { "code": "L", "price": 310 }
]
```

**Правила:**
- Для напитков (`coffee`, `tea`) `sizes` обязателен, содержит 1–3 элемента.  
  Поле `price` = минимальная цена из `sizes` (для сортировки и превью в каталоге).
- Для десертов `sizes = null`, `price` задаётся вручную.
- Сортировка в каталоге: `ORDER BY is_seasonal DESC, id ASC` — сезонные сверху.
- Валидация `sizes.code` — только `S`, `M`, `L`.
- При обновлении напитка без размеров сервер вернёт `400`.

**Индексы:**
- `idx_products_category` — по `category`
- `idx_products_seasonal` — по `is_seasonal`

---

### `toppings` — сиропы и топпинги

| Поле | Тип | Описание |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Идентификатор |
| `name` | VARCHAR(100) NOT NULL | Название |
| `type` | ENUM('syrup','topping') | Тип |
| `price` | DECIMAL(10,2) | Цена |
| `is_active` | BOOLEAN | `TRUE` — виден пользователям |
| `is_seasonal` | BOOLEAN | Сезонный |
| `expires_at` | DATE NULL | Дата окончания (для сезонных) |
| `created_at` | TIMESTAMP | Создан |

**Правила публичной выдачи (`GET /api/toppings`):**
```sql
WHERE is_active = TRUE
  AND (is_seasonal = FALSE OR expires_at IS NULL OR expires_at >= CURDATE())
ORDER BY is_seasonal DESC, type ASC, name ASC
```

То есть: только активные и не истёкшие. Админ видит все через `GET /api/toppings/admin`.

**Особенности:**
- Сезонные топпинги без `expires_at` отображаются всегда (пока `is_active = TRUE`).
- Если `expires_at` в прошлом — топпинг автоматически скрывается у пользователей.
- В заказах топпинги сохраняются как **снимок** (`id`, `name`, `price`) в `order_items.options`. Если топпинг потом удалят или изменят — старый заказ не пострадает.

**Индексы:**
- `idx_toppings_active` — по `is_active`
- `idx_toppings_seasonal` — по `is_seasonal`

---

### `orders` — заказы

| Поле | Тип | Описание |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Номер заказа |
| `user_id` | INT NULL FK → `users.id` | Автор (NULL для гостя) |
| `customer_name` | VARCHAR(150) | Имя на момент заказа |
| `customer_email` | VARCHAR(150) NULL | Email |
| `total` | DECIMAL(10,2) | Итоговая сумма |
| `status` | ENUM('new','paid','done','cancelled') | Статус |
| `payment_method` | ENUM('online','onsite') | Способ оплаты |
| `paid_at` | DATETIME NULL | Дата оплаты (ставится при статусе `paid`) |
| `stickers` | JSON NULL | Открытка: массив стикеров и текста |
| `created_at` | TIMESTAMP | Создан |

**Правила:**
- `user_id → NULL` при удалении пользователя (заказ остаётся).
- `status = 'paid'` автоматически проставляет `paid_at = NOW()`.
- `total` **пересчитывается на сервере** при создании — нельзя доверять клиенту.
- `payment_method` — обязательное, `online` или `onsite`. По умолчанию `onsite`.
- Гостевой заказ (`user_id = NULL`) — разрешён через `optionalAuth`.

**Формат `stickers`:**
```json
[
  {
    "type": "emoji",
    "content": "☕",
    "x": 45,
    "y": 60,
    "scale": 1.5,
    "rotation": 15
  },
  {
    "type": "text",
    "content": "Спасибо!",
    "x": 30,
    "y": 20,
    "scale": 1,
    "rotation": 0
  }
]
```

- `x`, `y` — проценты от 0 до 100 (позиция на открытке).
- `scale` — множитель (0.5–3).
- `rotation` — угол в градусах (0–360).
- `type` — `emoji` или `text`.

**Индексы:**
- `idx_orders_status` — по `status`
- `idx_orders_created` — по `created_at`
- `idx_orders_user` — по `user_id`

---

### `order_items` — позиции заказа

| Поле | Тип | Описание |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Идентификатор |
| `order_id` | INT NOT NULL FK → `orders.id` | Заказ (CASCADE) |
| `product_id` | INT NULL FK → `products.id` | Товар (SET NULL) |
| `name` | VARCHAR(150) NOT NULL | Снимок названия |
| `price` | DECIMAL(10,2) NOT NULL | Итоговая цена за единицу (размер + топпинги) |
| `qty` | INT NOT NULL | Количество |
| `options` | JSON NULL | Снимок размера и топпингов |

**Правила:**
- `name` и `price` — **снимки на момент заказа**. Если товар изменят или удалят, в старом заказе останется исторически верная информация.
- `product_id → NULL` при удалении товара — позиция не рушится.
- `price` = `base` (цена размера) + сумма `toppings[].price`.

**Формат `options`:**
```json
{
  "size": "M",
  "base": 280,
  "toppings": [
    { "id": 1, "name": "Карамельный сироп", "price": 30 },
    { "id": 5, "name": "Маршмеллоу", "price": 50 }
  ]
}
```

Итого `price = base + sum(toppings.price) = 280 + 30 + 50 = 360`.

Для десертов: `size = null`, `toppings = []`, `base = price` десерта.

---

### `posts` — блог

| Поле | Тип | Описание |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | Идентификатор |
| `title` | VARCHAR(200) NOT NULL | Заголовок |
| `excerpt` | VARCHAR(300) | Краткое описание |
| `body` | MEDIUMTEXT NOT NULL | Текст (с `\n\n` между абзацами) |
| `cover_url` | VARCHAR(500) | Обложка |
| `author_id` | INT NULL FK → `users.id` | Автор |
| `created_at` | TIMESTAMP | Создана |
| `updated_at` | TIMESTAMP | Обновлена |

**Правила:**
- `author_id → NULL` при удалении пользователя (статья остаётся).
- В `body` переносы `\n` внутри абзаца и `\n\n` между абзацами.  
  Фронт рендерит через `split(/\n{2,}/)` — каждый блок → `<p>`.
- При сохранении через API поле `author_id` берётся из `req.user.id`, клиент не может подделать.

**Индексы:**
- `idx_posts_created` — по `created_at`

---

## Связи между таблицами

| Связь | Тип | ON DELETE |
|---|---|---|
| `orders.user_id` → `users.id` | Many-to-One | `SET NULL` |
| `order_items.order_id` → `orders.id` | Many-to-One | `CASCADE` |
| `order_items.product_id` → `products.id` | Many-to-One | `SET NULL` |
| `posts.author_id` → `users.id` | Many-to-One | `SET NULL` |

**Почему именно так:**

- **`CASCADE` для позиций** — при удалении заказа его позиции тоже удаляются, мусора не остаётся.
- **`SET NULL` для пользователя** — заказы и статьи сохраняются, но теряют автора. История заказов важнее, чем ссылочная целостность.
- **`SET NULL` для товара** — позиция в старом заказе сохраняется с названием и ценой на момент заказа. Удаление товара из каталога не ломает историю.
- **`toppings` без FK** — топпинги меняются и удаляются со временем. Снимок в `order_items.options` защищает старые заказы.

---

## Тестовые данные

`schema.sql` содержит:

- **9 товаров** — кофе, чай, десерты. Один сезонный: **Тыквенный латте** (`is_seasonal = TRUE`).
- **8 топпингов** — 4 сиропа, 4 топпинга. Два сезонных: **Сироп солёная карамель**, **Тыквенная посыпка** (оба с `expires_at = '2026-12-31'`).
- **2 статьи** в блоге.

Пользователей создаёт `server/seed.js` (там bcrypt-хэши):

| Email | Пароль | Роль |
|---|---|---|
| `admin@coffee.ru` | `admin123` | admin |
| `user@coffee.ru` | `user123` | user |

---

## Особенности импорта

### Windows

Флаг `--default-character-set=utf8mb4` обязателен:

```bash
mysql -u root -p --default-character-set=utf8mb4 < database/schema.sql
```

Без него клиент MySQL прочитает файл в cp1251 и кириллица сохранится как `????`.

**Дополнительно:**
- Файл `schema.sql` должен быть сохранён в UTF-8 **без BOM**.  
  VS Code: правый нижний угол → `UTF-8` → Save with Encoding.
- Надёжный способ — импорт через Node (`database/import.js`):

```js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(sql);
  console.log('✓ Схема импортирована');
  await conn.end();
})().catch((err) => {
  console.error('Ошибка импорта:', err.message);
  process.exit(1);
});
```

Запуск: `node database/import.js`

---

## Миграции

Формальной системы миграций нет. При изменении схемы:

1. Правь `database/schema.sql`
2. Пересоздай БД:
   ```bash
   mysql -u root -p -e "DROP DATABASE IF EXISTS coffee_shop;"
   mysql -u root -p --default-character-set=utf8mb4 < database/schema.sql
   npm run seed
   ```
3. Если в БД были реальные данные — сделай дамп до пересоздания:
   ```bash
   mysqldump -u root -p coffee_shop > backup.sql
   ```

Для production-сценариев стоит добавить `knex` или `sequelize-cli`, но в учебном проекте это избыточно.

---

## Полезные SQL-запросы

**Выручка за 30 дней:**
```sql
SELECT SUM(total) AS revenue, COUNT(*) AS orders
FROM orders
WHERE status <> 'cancelled'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY);
```

**Топ-5 товаров по продажам:**
```sql
SELECT oi.name, SUM(oi.qty) AS sold
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.status <> 'cancelled'
GROUP BY oi.name
ORDER BY sold DESC
LIMIT 5;
```

**Активные топпинги для пользователей:**
```sql
SELECT id, name, type, price, is_seasonal, expires_at
FROM toppings
WHERE is_active = TRUE
  AND (is_seasonal = FALSE OR expires_at IS NULL OR expires_at >= CURDATE())
ORDER BY is_seasonal DESC, type ASC, name ASC;
```

**Заказы пользователя с позициями:**
```sql
SELECT o.id, o.total, o.status, o.created_at,
       oi.name, oi.qty, oi.price, oi.options
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = 2
ORDER BY o.created_at DESC;
```