# API

**Базовый URL:** `http://localhost:3000/api`  
**Формат:** JSON (`Content-Type: application/json`)  
**Авторизация:** JWT в заголовке `Authorization: Bearer <token>`

---

## 📑 Содержание

- [Общие правила](#общие-правила)
- [Auth](#-auth)
- [Products](#-products)
- [Toppings](#-toppings)
- [Orders](#-orders)
- [Posts](#-posts)
- [Admin](#-admin)
- [Upload](#-upload)
- [Коды ошибок](#коды-ошибок)

---

## Общие правила

### Формат ошибок

Все ошибки возвращаются в едином формате:

```json
{ "message": "Текст ошибки" }
```

Для ошибок валидации — массив `errors`:

```json
{
  "message": "Ошибка валидации",
  "errors": [
    "name — обязательное поле",
    "price — неотрицательное число"
  ]
}
```

### Авторизация

**Публичные эндпоинты** — доступны без токена.

**🔒 Требует авторизации** — нужен валидный JWT в заголовке:
```
Authorization: Bearer eyJhbGciOi...
```

**🔒 admin** — дополнительно требует роль `admin`.

Если токен отсутствует или невалиден → `401`:
```json
{ "message": "Требуется авторизация" }
```

Если роль не подходит → `403`:
```json
{ "message": "Требуется роль администратора" }
```

### Типы данных в ответах

- **`DECIMAL`** (`price`, `total`) приходит **строкой**: `"280.00"`. Это поведение `mysql2` — так не теряется точность. На фронте конвертируется через `Number()`.
- **`JSON`** (`sizes`, `stickers`, `options`) — распарсенные объекты/массивы, не строки.
- **`BOOLEAN`** (`is_seasonal`, `is_active`) — `true` / `false`.
- **`TIMESTAMP`** — ISO-строка: `"2026-10-20T06:15:34.000Z"`.
- **`DATE`** (`expires_at`) — `"YYYY-MM-DD"` или `null`.

---

## 🔐 Auth

### `POST /api/auth/register`

Регистрация нового пользователя.

**Публичный.**

**Тело:**
```json
{
  "name": "Иван",
  "email": "ivan@example.com",
  "password": "secret123"
}
```

**Валидация:**
- `name` — минимум 2 символа
- `email` — валидный адрес
- `password` — минимум 6 символов

**Успех `201`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 3,
    "name": "Иван",
    "email": "ivan@example.com",
    "role": "user",
    "created_at": "2026-10-20T06:15:34.000Z"
  }
}
```

**Ошибки:**
- `400` — валидация (`errors[]`)
- `409` — email уже занят:
  ```json
  { "message": "Пользователь с таким email уже существует" }
  ```

---

### `POST /api/auth/login`

Вход.

**Публичный.**

**Тело:**
```json
{ "email": "admin@coffee.ru", "password": "admin123" }
```

**Успех `200`:**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": 1,
    "name": "Администратор",
    "email": "admin@coffee.ru",
    "role": "admin",
    "created_at": "2026-10-20T05:00:00.000Z"
  }
}
```

**Ошибки:**
- `400` — не указан email или пароль
- `401` — неверный email или пароль (сообщение не раскрывает, что именно не так)

---

### `GET /api/auth/me`

Текущий пользователь по токену.

**🔒 Требует авторизации.**

**Успех `200`:**
```json
{
  "user": {
    "id": 1,
    "name": "Администратор",
    "email": "admin@coffee.ru",
    "role": "admin",
    "created_at": "2026-10-20T05:00:00.000Z"
  }
}
```

**Ошибки:** `401` — токен отсутствует, истёк или невалиден.

---

## ☕ Products

### `GET /api/products`

Список товаров. **Публичный.**

Сезонные — в приоритете (`ORDER BY is_seasonal DESC, id ASC`).

**Query-параметры:**

| Параметр | Тип | Описание |
|---|---|---|
| `category` | `coffee` \| `tea` \| `dessert` | Фильтр по категории |
| `search` | string | Поиск по названию (LIKE) |
| `seasonal` | `1` \| `true` | Только сезонные |

**Примеры:**
```
GET /api/products
GET /api/products?category=coffee
GET /api/products?search=лат
GET /api/products?seasonal=1
GET /api/products?category=tea&search=матча
```

**Успех `200`:**
```json
{
  "products": [
    {
      "id": 5,
      "name": "Тыквенный латте",
      "category": "coffee",
      "price": "320.00",
      "description": "Сезонный латте с тыквой и специями.",
      "image_url": "/uploads/img-1697-abc.jpg",
      "sizes": [
        { "code": "S", "price": 290 },
        { "code": "M", "price": 320 },
        { "code": "L", "price": 350 }
      ],
      "is_seasonal": true,
      "created_at": "2026-10-20T06:15:34.000Z"
    }
  ],
  "count": 9
}
```

**Для десерта:** `sizes: null`, `price` — фиксированная цена.

---

### `GET /api/products/:id`

Один товар. **Публичный.**

**Успех `200`:** объект товара (без обёртки):
```json
{
  "id": 3,
  "name": "Латте",
  "category": "coffee",
  "price": "280.00",
  "description": "Эспрессо с подогретым молоком.",
  "image_url": "/uploads/img-xxx.jpg",
  "sizes": [
    { "code": "S", "price": 250 },
    { "code": "M", "price": 280 },
    { "code": "L", "price": 310 }
  ],
  "is_seasonal": false,
  "created_at": "2026-10-20T06:15:34.000Z"
}
```

**Ошибки:** `404` — товар не найден.

---

### `POST /api/products` 🔒 admin

Создание товара.

**Для напитка (кофе / чай):**
```json
{
  "name": "Флэт уайт",
  "category": "coffee",
  "description": "Двойной эспрессо с молоком",
  "image_url": "/uploads/img-flatwhite.jpg",
  "sizes": [
    { "code": "S", "price": 260 },
    { "code": "M", "price": 290 }
  ],
  "is_seasonal": false
}
```

**Для десерта:**
```json
{
  "name": "Маффин",
  "category": "dessert",
  "description": "Шоколадный маффин",
  "image_url": "/uploads/img-muffin.jpg",
  "price": 150,
  "sizes": null,
  "is_seasonal": false
}
```

**Валидация:**
- `name` — не пустое
- `category` — `coffee` / `tea` / `dessert`
- `price` — неотрицательное число
- `sizes.code` — только `S`, `M`, `L`
- `sizes.price` — неотрицательное число

**Успех `201`:** созданный товар (как `GET /api/products/:id`).

**Примечание:** если передан `sizes`, сервер автоматически ставит `price = min(sizes[].price)`, даже если клиент передал другой `price`.

---

### `PUT /api/products/:id` 🔒 admin

Частичное обновление. Передавай только изменяемые поля.

**Пример — изменить только цену:**
```json
{ "price": 300 }
```

**Пример — добавить размер:**
```json
{
  "sizes": [
    { "code": "S", "price": 260 },
    { "code": "M", "price": 290 },
    { "code": "L", "price": 320 }
  ]
}
```

**Пример — перевести десерт в напиток** (не рекомендуется, но работает):
```json
{
  "sizes": [
    { "code": "M", "price": 250 }
  ]
}
```

**Успех `200`:** обновлённый товар.

**Ошибки:** `400` — валидация, `404` — товар не найден.

---

### `DELETE /api/products/:id` 🔒 admin

Удаление.

**Успех `200`:**
```json
{ "success": true, "id": 9 }
```

**Ошибки:** `404` — товар не найден.

**Примечание:** старые заказы не ломаются. В `order_items.product_id` становится `NULL`, а `name` и `price` остаются снимком на момент заказа.

---

## 🍯 Toppings

### `GET /api/toppings`

Публичный список — **только активные и не истёкшие**.

**Успех `200`:**
```json
{
  "toppings": [
    {
      "id": 4,
      "name": "Сироп солёная карамель",
      "type": "syrup",
      "price": "45.00",
      "is_active": true,
      "is_seasonal": true,
      "expires_at": "2026-12-31"
    },
    {
      "id": 1,
      "name": "Карамельный сироп",
      "type": "syrup",
      "price": "30.00",
      "is_active": true,
      "is_seasonal": false,
      "expires_at": null
    }
  ]
}
```

Сортировка: сезонные → по типу (`syrup`/`topping`) → по имени.

---

### `GET /api/toppings/admin` 🔒 admin

Все топпинги, включая отключённые и просроченные. Для админ-панели.

**Успех `200`:**
```json
{
  "toppings": [
    { "id": 4, "name": "Сироп солёная карамель", "type": "syrup", "price": "45.00", "is_active": true, "is_seasonal": true, "expires_at": "2026-12-31", "created_at": "..." },
    { "id": 1, "name": "Карамельный сироп", "type": "syrup", "price": "30.00", "is_active": true, "is_seasonal": false, "expires_at": null, "created_at": "..." },
    { "id": 7, "name": "Старый топпинг", "type": "topping", "price": "20.00", "is_active": false, "is_seasonal": false, "expires_at": null, "created_at": "..." }
  ]
}
```

Сортировка: активные → сезонные → по имени.

---

### `POST /api/toppings` 🔒 admin

Создание.

**Тело:**
```json
{
  "name": "Мятный сироп",
  "type": "syrup",
  "price": 35,
  "is_active": true,
  "is_seasonal": false,
  "expires_at": null
}
```

**Сезонный с датой:**
```json
{
  "name": "Новогодняя посыпка",
  "type": "topping",
  "price": 60,
  "is_active": true,
  "is_seasonal": true,
  "expires_at": "2026-12-31"
}
```

**Валидация:**
- `name` — не пустое
- `type` — `syrup` / `topping`
- `price` — неотрицательное число

**Успех `201`:** созданный топпинг.

---

### `PUT /api/toppings/:id` 🔒 admin

Обновление (partial).

**Пример — скрыть от пользователей:**
```json
{ "is_active": false }
```

**Пример — сделать сезонным с датой:**
```json
{ "is_seasonal": true, "expires_at": "2027-03-01" }
```

**Успех `200`:** обновлённый топпинг.

---

### `DELETE /api/toppings/:id` 🔒 admin

Удаление.

**Успех `200`:**
```json
{ "success": true, "id": 8 }
```

**Примечание:** старые заказы не ломаются — в `order_items.options` уже сохранены снимки.

---

## 🧾 Orders

### `POST /api/orders`

Создание заказа. **Доступно и гостям, и авторизованным** (опциональная авторизация).

Если передан `Bearer` — заказ привяжется к `user_id`, а `customer_name` и `customer_email` возьмутся из профиля.

**Тело:**
```json
{
  "items": [
    {
      "product_id": 3,
      "qty": 1,
      "size_code": "M",
      "topping_ids": [1, 5]
    },
    {
      "product_id": 7,
      "qty": 2,
      "size_code": null,
      "topping_ids": []
    }
  ],
  "stickers": [
    {
      "type": "emoji",
      "content": "☕",
      "x": 45,
      "y": 60,
      "scale": 1.5,
      "rotation": 15
    }
  ],
  "payment_method": "online"
}
```

**Поля `items[]`:**

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `product_id` | int | да | ID товара |
| `qty` | int | да | Количество (≥ 1) |
| `size_code` | `"S"` \| `"M"` \| `"L"` \| null | да* | Размер для напитков |
| `topping_ids` | int[] | нет | ID топпингов |

*Для десертов `size_code = null` или не передаётся.

**Поля `payment_method`:** `"online"` \| `"onsite"`. Обязательно. По умолчанию `onsite`.

**Правила сервера:**
- **`total` и `price` пересчитываются на сервере** по актуальным ценам из БД. Клиентский `price` игнорируется.
- Если товар или топпинг недоступен (удалён, отключён, просрочен) — весь заказ откатывается (`400`).
- Размер проверяется: должен быть в `product.sizes`. Если не указан — берётся первый доступный.
- Всё выполняется в **транзакции**: либо заказ создан целиком, либо ничего.

**Успех `201`:**
```json
{
  "id": 5,
  "user_id": 2,
  "customer_name": "Степан",
  "customer_email": "user@coffee.ru",
  "total": "890.00",
  "status": "new",
  "payment_method": "online",
  "paid_at": null,
  "stickers": [
    { "type": "emoji", "content": "☕", "x": 45, "y": 60, "scale": 1.5, "rotation": 15 }
  ],
  "created_at": "2026-10-20T10:30:00.000Z",
  "items": [
    {
      "id": 12,
      "product_id": 3,
      "name": "Латте",
      "price": "360.00",
      "qty": 1,
      "options": {
        "size": "M",
        "base": 280,
        "toppings": [
          { "id": 1, "name": "Карамельный сироп", "price": 30 },
          { "id": 5, "name": "Маршмеллоу", "price": 50 }
        ]
      }
    },
    {
      "id": 13,
      "product_id": 7,
      "name": "Круассан",
      "price": "180.00",
      "qty": 2,
      "options": {
        "size": null,
        "base": 180,
        "toppings": []
      }
    }
  ]
}
```

**Ошибки:**
- `400` — пустой заказ, товар/топпинг недоступен, некорректный `payment_method`, размер не найден
  ```json
  { "message": "Товар #99 не найден" }
  { "message": "Размер XL недоступен для «Латте»" }
  { "message": "Топпинг #999 недоступен" }
  ```

---

### `GET /api/orders` 🔒 admin

Список всех заказов.

**Query-параметры:**
- `status` — `new` \| `paid` \| `done` \| `cancelled`

**Пример:**
```
GET /api/orders?status=paid
```

**Успех `200`:**
```json
{
  "orders": [
    {
      "id": 5,
      "user_id": 2,
      "customer_name": "Степан",
      "customer_email": "user@coffee.ru",
      "total": "890.00",
      "status": "paid",
      "payment_method": "online",
      "paid_at": "2026-10-20T10:35:00.000Z",
      "created_at": "2026-10-20T10:30:00.000Z",
      "items": [
        { "id": 12, "product_id": 3, "name": "Латте", "price": "360.00", "qty": 1, "options": {...} }
      ]
    }
  ],
  "count": 1
}
```

Сортировка: `created_at DESC` (новые сверху). Каждый заказ содержит массив `items`.

---

### `GET /api/orders/mine` 🔒 user

Заказы текущего пользователя.

**Успех `200`:**
```json
{
  "orders": [
    {
      "id": 5,
      "total": "890.00",
      "status": "paid",
      "payment_method": "online",
      "paid_at": "2026-10-20T10:35:00.000Z",
      "created_at": "2026-10-20T10:30:00.000Z",
      "items": [
        { "id": 12, "name": "Латте", "price": "360.00", "qty": 1, "options": {...} }
      ]
    }
  ]
}
```

**Ошибки:** `401` — не авторизован.

---

### `GET /api/orders/:id` 🔒 user

Один заказ. Доступен **только владельцу или админу**.

**Успех `200`:** объект заказа (как в `POST /api/orders`).

**Ошибки:**
- `403` — чужой заказ
  ```json
  { "message": "Нет доступа к этому заказу" }
  ```
- `404` — заказ не найден

---

### `PATCH /api/orders/:id/status` 🔒 admin

Смена статуса.

**Тело:**
```json
{ "status": "paid" }
```

**Допустимые статусы:** `new`, `paid`, `done`, `cancelled`.

**Особенность:** при `status = 'paid'` автоматически проставляется `paid_at = NOW()` (если ещё не установлено).

**Успех `200`:** обновлённый заказ (как `GET /api/orders/:id`).

**Ошибки:**
- `400` — невалидный статус
- `404` — заказ не найден

---

## 📝 Posts

### `GET /api/posts`

Список статей. **Публичный.**

**Успех `200`:**
```json
{
  "posts": [
    {
      "id": 1,
      "title": "Как выбрать зерно для дома",
      "excerpt": "Разбираемся в сортах, обжарке и помоле.",
      "body": "Хороший кофе начинается с зерна...",
      "cover_url": "https://picsum.photos/seed/beans/1200/600",
      "author": "Администратор",
      "created_at": "2026-10-20T06:15:34.000Z",
      "updated_at": "2026-10-20T06:15:34.000Z"
    }
  ],
  "count": 2
}
```

- `author` — имя пользователя из JOIN (или `null`, если автор удалён).
- Сортировка: `created_at DESC`.

---

### `GET /api/posts/:id`

Одна статья. **Публичный.**

**Успех `200`:** объект статьи (как в списке).

**Ошибки:** `404` — статья не найдена.

---

### `POST /api/posts` 🔒 admin

Создание.

**Тело:**
```json
{
  "title": "Новая статья",
  "excerpt": "Краткое описание",
  "body": "Текст статьи.\n\nВторой абзац.",
  "cover_url": "/uploads/post-1.jpg"
}
```

**Валидация:**
- `title` — не пустое
- `body` — не пустое
- `excerpt` — максимум 300 символов

**Особенность:** `author_id` подставляется из `req.user.id` — клиент не может подделать автора.

**Успех `201`:** созданная статья с `author` = текущий админ.

---

### `PUT /api/posts/:id` 🔒 admin

Обновление (partial).

**Пример — изменить только заголовок:**
```json
{ "title": "Новый заголовок" }
```

**Успех `200`:** обновлённая статья.

**Ошибки:** `404` — статья не найдена.

---

### `DELETE /api/posts/:id` 🔒 admin

Удаление.

**Успех `200`:**
```json
{ "success": true, "id": 3 }
```

**Ошибки:** `404` — статья не найдена.

---

## 📊 Admin

### `GET /api/admin/stats` 🔒 admin

KPI и данные для графиков.

**Успех `200`:**
```json
{
  "revenue": 2020,
  "orders": 4,
  "avgCheck": 505,
  "newUsers": 3,
  "salesByDay": [
    { "day": "Ср", "value": 0 },
    { "day": "Чт", "value": 0 },
    { "day": "Пт", "value": 0 },
    { "day": "Сб", "value": 0 },
    { "day": "Вс", "value": 0 },
    { "day": "Пн", "value": 0 },
    { "day": "Вт", "value": 2020 }
  ],
  "topProducts": [
    { "name": "Эспрессо", "value": 6 },
    { "name": "Капучино", "value": 2 },
    { "name": "Круассан", "value": 2 },
    { "name": "Облепиховый чай", "value": 1 }
  ]
}
```

**Что считается:**

| Поле | Период | Правило |
|---|---|---|
| `revenue` | 30 дней | Сумма `total` не-отменённых заказов |
| `orders` | 30 дней | Количество не-отменённых заказов |
| `avgCheck` | 30 дней | `revenue / orders`, округлено |
| `newUsers` | 30 дней | Новые регистрации |
| `salesByDay` | 7 дней | Сумма по дням, пропущенные дни = 0, подписи Пн–Вс |
| `topProducts` | всё время | Топ-5 по сумме `qty` в `order_items` |

**Исключения:** заказы со статусом `cancelled` **не учитываются** нигде.

**Формат `salesByDay`:** ровно 7 элементов, последний — сегодня. Порядок: от 6 дней назад до сегодня. Метки дней — русские (`Пн`, `Вт`, ...).

---

## 📤 Upload

### `POST /api/upload` 🔒 admin

Загрузка изображения (для товаров и блога).

**Формат:** `multipart/form-data`  
**Поле:** `image`

**Ограничения:**
- Форматы: JPEG, PNG, WebP, GIF
- Размер: до 5 МБ

**Пример через `curl`:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer <admin-token>" \
  -F "image=@/path/to/photo.jpg"
```

**Успех `200`:**
```json
{ "url": "/uploads/img-1697891234567-abc123.jpg" }
```

Файл сохраняется в `client/public/uploads/` и сразу доступен по URL.

**Ошибки:**
- `400` — файл не передан
  ```json
  { "message": "Файл не получен" }
  ```
- `400` — неподдерживаемый формат / слишком большой файл (обрабатывается `multer`)

---

## Коды ошибок

| Код | Когда возникает |
|---|---|
| `200 OK` | Успешный GET / PUT / PATCH / DELETE |
| `201 Created` | Успешный POST |
| `400 Bad Request` | Ошибки валидации, недоступные товары/топпинги, некорректный статус |
| `401 Unauthorized` | Нет токена, токен истёк или невалиден |
| `403 Forbidden` | Не хватает прав (не админ / чужой заказ) |
| `404 Not Found` | Ресурс не найден |
| `409 Conflict` | Email уже занят при регистрации |
| `500 Internal Server Error` | Ошибка на сервере (БД, необработанное исключение) |

---

## Жизненный цикл токена

1. **Получение** — `POST /api/auth/login` или `/register`. Токен живёт `7d` (по `JWT_EXPIRES_IN`).
2. **Использование** — заголовок `Authorization: Bearer <token>` в каждом запросе, где требуется авторизация.
3. **Истечение** — через 7 дней сервер вернёт `401`. Фронт (`api.js`) автоматически очищает `localStorage` при `401`, `header.js` ловит `auth:logout` и сбрасывает кнопки в шапке.
4. **Выход** — на клиенте: `window.api.logout()` удаляет `token` и `user` из `localStorage`, кидает событие `auth:logout`. На сервере ничего не делается — JWT stateless.

---

## Примеры через curl

### Регистрация и вход

```bash
# Регистрация
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Иван","email":"ivan@example.com","password":"secret123"}'

# Вход
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@coffee.ru","password":"admin123"}'
```

### Создание заказа

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items":[
      {"product_id":3,"qty":1,"size_code":"M","topping_ids":[1,5]},
      {"product_id":7,"qty":2,"size_code":null,"topping_ids":[]}
    ],
    "stickers":[
      {"type":"emoji","content":"☕","x":45,"y":60,"scale":1.5,"rotation":15}
    ],
    "payment_method":"online"
  }'
```

### Загрузка изображения

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer <admin-token>" \
  -F "image=@photo.jpg"
```

### Смена статуса заказа

```bash
curl -X PATCH http://localhost:3000/api/orders/5/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"paid"}'
```