# MyCoffeCup

Веб-приложение кофейни: онлайн-каталог, корзина с кастомизацией напитков,
оформление заказов, блог, личный кабинет и полноценная админ-панель.

**Стек:** Node.js · Express · MySQL · JWT · multer · Chart.js · чистый JavaScript на клиенте.



##  Документация

**Основная (для сдачи):**
- **[Общая документация](docs/documentation.md)** — функции, реализация, стек, архитектура
- **[Тестирование](docs/testing.md)** — матрица тест-кейсов и результаты

**Справочная:**
- **[API](docs/api.md)** — все эндпоинты с примерами
- **[База данных](docs/database.md)** — схема, поля, связи
- **[Руководство пользователя](docs/user-guide.md)** — как пользоваться сайтом и админкой

## Возможности

### Пользователь
- Каталог с поиском, фильтром по категории и «только сезонные»
- Сезонные напитки — в приоритете, с бейджем
- Выбор размера (S / M / L) — цена пересчитывается
- Добавки: сиропы и топпинги (сезонные помечены)
- Корзина: редактирование позиции, мердж одинаковых конфигураций
- Открытка к заказу: drag & drop эмодзи-стикеров и текст с масштабом и поворотом
- Оформление заказа: онлайн или на месте
- Красивый печатный чек
- «Мои заказы»: повтор, просмотр чека
- Выбор температуры напитка (горячий / холодный), если доступно

### Администратор
- Управление товарами: drag & drop фото, размеры, сезонность, опция «можно охлаждённым»
- Управление топпингами: включение/отключение, сезонные с датой окончания
- Управление блогом
- Управление заказами: смена статуса, чек
- Статистика: выручка, средний чек, новые клиенты, графики



### Установка и запуск

### Требования
- Node.js 18+
- MySQL 5.7+ / MariaDB 10.3+

### 1. Установка зависимостей
```bash
npm install '''


### 2. Переменные окружения

.env.example -> .env

PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=coffee_shop
JWT_SECRET=change_me_to_long_random_string
JWT_EXPIRES_IN=7d

### 3.  Создание БД

mysql -u root -p -e "DROP DATABASE IF EXISTS coffee_shop;"

mysql -u root -p --default-character-set=utf8mb4 < database/schema.sql

! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! !
Windows: флаг --default-character-set=utf8mb4 обязателен.
Без него кириллица сохранится как ????.
Файл schema.sql должен быть в UTF-8 без BOM.
! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! !

### 4. демо-пользователи

npm run seed

будут созданы пользователи:

name: 'Администратор', email: 'admin@coffee.ru', password: 'admin123', role: 'admin' 
name: 'Пользователь',  email: 'user@coffee.ru',  password: 'user123',  role: 'user'

### 5. Запуск

npm run dev

---
###Структура

MyCoffeCup/
├── client/public/                 # Фронтенд (статика)
│   ├── index.html                 # Каталог
│   ├── product.html               # Карточка товара
│   ├── cart.html                  # Корзина
│   ├── checkout.html              # Оформление
│   ├── receipt.html               # Чек
│   ├── profile.html               # Мои заказы
│   ├── blog.html, blog-post.html  # Блог
│   ├── login.html                 # Вход / регистрация
│   ├── admin/                     # Админ-панель
│   │   ├── dashboard.html         # Статистика
│   │   ├── products.html          # Товары
│   │   ├── toppings.html          # Топпинги
│   │   ├── content.html           # Блог
│   │   └── orders.html            # Заказы
│   ├── css/style.css              # Единый файл стилей
│   ├── js/
│   │   ├── api.js                 # Обёртка над fetch
│   │   ├── header.js              # Шапка, бургер, авторизация
│   │   ├── catalog.js             # Каталог и товар
│   │   ├── cart.js                # Корзина и редактор позиции
│   │   ├── checkout.js            # Оформление
│   │   ├── receipt.js             # Чек
│   │   ├── profile.js             # Мои заказы
│   │   ├── auth.js                # Логин/регистрация
│   │   ├── blog.js                # Блог
│   │   ├── stickers.js            # Открытка
│   │   ├── admin.js               # Админка
│   │   └── vendor/chart.umd.min.js
│   └── uploads/                   # Загруженные изображения (gitignore)
│
├── server/
│   ├── app.js                     # Express-приложение
│   ├── seed.js                    # Демо-пользователи
│   ├── config/db.js               # Пул mysql2
│   ├── middleware/
│   │   ├── authMiddleware.js      # requireAuth / requireAdmin / optionalAuth
│   │   └── upload.js              # multer
│   ├── models/                    # Слой БД
│   ├── controllers/               # Валидация и ответы
│   └── routes/                    # REST-маршруты
│
├── database/schema.sql            # Схема и тестовые данные
├── .env.example
├── package.json
└── README.md

### Скрипты

npm start	Запуск без --watch (production)
npm run dev	  Запуск с авто-перезагрузкой
npm run seed	Создание демо-пользователей

### Оформление
Eco Cardboard — картонная палитра: тёплые бумажные фоны 
( #EDE3CE, #F2E6C9 ), лесной зелёный бренд ( #2D6A4F), глиняный акцент ( #B5651D).

### заметки
.env в .gitignore — секреты не попадают в репозиторий

client/public/uploads/ не коммитится — пользовательский контент

Chart.js подключён локально (/js/vendor/chart.umd.min.js), не через CDN —
работает без интернета при демонстрации

Корзина на клиенте в localStorage, серверу не нужна — данные передаются
только при оформлении заказа

price из API приходит строкой (DECIMAL в mysql2) — на фронте конвертируется
через Number()