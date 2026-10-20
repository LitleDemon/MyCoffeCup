const pool = require('../config/db');

const ALLOWED_STATUSES = ['new', 'paid', 'done', 'cancelled'];

/**
 * Создаёт заказ с позициями в одной транзакции.
 * @param {object} data  { userId, customerName, customerEmail, items, stickers }
 *   items = [{ product_id, qty }]
 */
async function create({ userId, customerName, customerEmail, items, stickers }) {
  if (!items || !items.length) {
    const err = new Error('Пустой заказ');
    err.status = 400;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Проверяем товары и собираем позиции со снимками названия/цены
    const ids = items.map((i) => Number(i.product_id));
    const [products] = await conn.query(
      `SELECT id, name, price FROM products WHERE id IN (?)`,
      [ids]
    );
    const byId = new Map(products.map((p) => [p.id, p]));

    const positions = items.map((i) => {
      const product = byId.get(Number(i.product_id));
      if (!product) {
        const err = new Error(`Товар #${i.product_id} не найден`);
        err.status = 400;
        throw err;
      }
      const qty = Math.max(1, parseInt(i.qty, 10) || 1);
      return {
        product_id: product.id,
        name: product.name,
        price: product.price,
        qty,
      };
    });

    const total = positions.reduce(
      (sum, p) => sum + Number(p.price) * p.qty,
      0
    );

    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, customer_name, customer_email, total, status, stickers)
       VALUES (?, ?, ?, ?, 'new', ?)`,
      [
        userId || null,
        customerName || 'Гость',
        customerEmail || null,
        total.toFixed(2),
        stickers ? JSON.stringify(stickers) : null,
      ]
    );

    const orderId = orderResult.insertId;

    const values = positions.map((p) => [orderId, p.product_id, p.name, p.price, p.qty]);
    await conn.query(
      `INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES ?`,
      [values]
    );

    await conn.commit();
    return getById(orderId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const [orders] = await pool.query(
    `SELECT id, user_id, customer_name, customer_email, total, status, stickers, created_at
       FROM orders WHERE id = ?`,
    [id]
  );
  const order = orders[0];
  if (!order) return null;

  const [items] = await pool.query(
    `SELECT id, product_id, name, price, qty FROM order_items WHERE order_id = ?`,
    [id]
  );
  order.items = items;
  order.stickers = order.stickers ? safeJson(order.stickers) : [];
  return order;
}

async function getAll({ status } = {}) {
  const conditions = [];
  const params = [];

  if (status && ALLOWED_STATUSES.includes(status)) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [orders] = await pool.query(
    `SELECT id, user_id, customer_name, customer_email, total, status, created_at
       FROM orders
       ${where}
       ORDER BY created_at DESC`,
    params
  );

  if (!orders.length) return [];

  // Подтягиваем позиции одним запросом
  const ids = orders.map((o) => o.id);
  const [items] = await pool.query(
    `SELECT order_id, id, product_id, name, price, qty FROM order_items WHERE order_id IN (?)`,
    [ids]
  );
  const byOrder = new Map();
  items.forEach((it) => {
    if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
    byOrder.get(it.order_id).push(it);
  });

  orders.forEach((o) => { o.items = byOrder.get(o.id) || []; });
  return orders;
}

async function updateStatus(id, status) {
  if (!ALLOWED_STATUSES.includes(status)) {
    const err = new Error('Недопустимый статус');
    err.status = 400;
    throw err;
  }
  const [result] = await pool.query(
    'UPDATE orders SET status = ? WHERE id = ?',
    [status, id]
  );
  if (!result.affectedRows) return null;
  return getById(id);
}

/* JSON из mysql2 иногда приходит строкой, иногда объектом */
function safeJson(v) {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return []; }
  }
  return v;
}

module.exports = { create, getById, getAll, updateStatus, ALLOWED_STATUSES };