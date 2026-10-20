const pool = require('../config/db');

const ALLOWED_STATUSES = ['new', 'paid', 'done', 'cancelled'];
const ALLOWED_PAYMENTS = ['online', 'onsite'];

/**
 * Создаёт заказ с позициями и топпингами в одной транзакции.
 * items = [{ product_id, qty, size_code?, topping_ids?: [] }]
 */
async function create({ userId, customerName, customerEmail, items, stickers, paymentMethod }) {
  if (!items || !items.length) {
    const err = new Error('Пустой заказ');
    err.status = 400;
    throw err;
  }
  if (!ALLOWED_PAYMENTS.includes(paymentMethod)) {
    const err = new Error('Некорректный способ оплаты');
    err.status = 400;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Загружаем товары
    const ids = [...new Set(items.map((i) => Number(i.product_id)))];
    const [products] = await conn.query(
      `SELECT id, name, price, sizes FROM products WHERE id IN (?)`,
      [ids]
    );
    const productById = new Map(products.map((p) => {
      if (typeof p.sizes === 'string') {
        try { p.sizes = JSON.parse(p.sizes); } catch { p.sizes = null; }
      }
      return [p.id, p];
    }));

    // Загружаем топпинги (один раз)
    const allToppingIds = [...new Set(
      items.flatMap((i) => (Array.isArray(i.topping_ids) ? i.topping_ids : []).map(Number))
    )];
    let toppingById = new Map();
    if (allToppingIds.length) {
      const [toppings] = await conn.query(
        `SELECT id, name, price FROM toppings
          WHERE id IN (?)
            AND is_active = TRUE
            AND (is_seasonal = FALSE OR expires_at IS NULL OR expires_at >= CURDATE())`,
        [allToppingIds]
      );
      toppingById = new Map(toppings.map((t) => [t.id, t]));
    }

    const positions = items.map((i) => {
      const product = productById.get(Number(i.product_id));
      if (!product) {
        const err = new Error(`Товар #${i.product_id} не найден`);
        err.status = 400;
        throw err;
      }
      const qty = Math.max(1, parseInt(i.qty, 10) || 1);

      /* Определяем базовую цену по размеру */
      let basePrice = Number(product.price);
      let sizeCode = null;
      if (product.sizes && product.sizes.length) {
        const sizes = product.sizes;
        const requested = i.size_code || sizes[0].code;
        const found = sizes.find((s) => s.code === requested);
        if (!found) {
          const err = new Error(`Размер ${requested} недоступен для «${product.name}»`);
          err.status = 400;
          throw err;
        }
        basePrice = Number(found.price);
        sizeCode = found.code;
      }

      /* Топпинги */
      const selectedToppings = [];
      if (Array.isArray(i.topping_ids)) {
        for (const tid of i.topping_ids) {
          const t = toppingById.get(Number(tid));
          if (!t) {
            const err = new Error(`Топпинг #${tid} недоступен`);
            err.status = 400;
            throw err;
          }
          selectedToppings.push({ id: t.id, name: t.name, price: Number(t.price) });
        }
      }

      const toppingsPrice = selectedToppings.reduce((s, t) => s + t.price, 0);
      const unitPrice = basePrice + toppingsPrice;

      return {
        product_id: product.id,
        name: product.name,
        price: unitPrice,
        qty,
        options: {
          size: sizeCode,
          base: basePrice,
          toppings: selectedToppings,
        },
      };
    });

    const total = positions.reduce((sum, p) => sum + Number(p.price) * p.qty, 0);

    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, customer_name, customer_email, total, status, payment_method, stickers)
       VALUES (?, ?, ?, ?, 'new', ?, ?)`,
      [
        userId || null,
        customerName || 'Гость',
        customerEmail || null,
        total.toFixed(2),
        paymentMethod,
        stickers ? JSON.stringify(stickers) : null,
      ]
    );

    const orderId = orderResult.insertId;
    const values = positions.map((p) => [
      orderId, p.product_id, p.name, p.price, p.qty, JSON.stringify(p.options),
    ]);
    await conn.query(
      `INSERT INTO order_items (order_id, product_id, name, price, qty, options) VALUES ?`,
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
    `SELECT id, user_id, customer_name, customer_email, total, status, payment_method, paid_at, stickers, created_at
       FROM orders WHERE id = ?`,
    [id]
  );
  const order = orders[0];
  if (!order) return null;

  const [items] = await pool.query(
    `SELECT id, product_id, name, price, qty, options FROM order_items WHERE order_id = ?`,
    [id]
  );
  order.items = items.map((it) => {
    if (typeof it.options === 'string') {
      try { it.options = JSON.parse(it.options); } catch { it.options = null; }
    }
    return it;
  });
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
    `SELECT id, user_id, customer_name, customer_email, total, status, payment_method, paid_at, created_at
       FROM orders ${where} ORDER BY created_at DESC`,
    params
  );
  if (!orders.length) return [];

  const ids = orders.map((o) => o.id);
  const [items] = await pool.query(
    `SELECT order_id, id, product_id, name, price, qty, options FROM order_items WHERE order_id IN (?)`,
    [ids]
  );
  const byOrder = new Map();
  items.forEach((it) => {
    if (typeof it.options === 'string') {
      try { it.options = JSON.parse(it.options); } catch { it.options = null; }
    }
    if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
    byOrder.get(it.order_id).push(it);
  });
  orders.forEach((o) => { o.items = byOrder.get(o.id) || []; });
  return orders;
}

async function getMine(userId) {
  const [orders] = await pool.query(
    `SELECT id, total, status, payment_method, paid_at, created_at
       FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  if (!orders.length) return [];

  const ids = orders.map((o) => o.id);
  const [items] = await pool.query(
    `SELECT order_id, id, name, price, qty, options FROM order_items WHERE order_id IN (?)`,
    [ids]
  );
  const byOrder = new Map();
  items.forEach((it) => {
    if (typeof it.options === 'string') {
      try { it.options = JSON.parse(it.options); } catch { it.options = null; }
    }
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
  const setPaid = status === 'paid' ? ', paid_at = NOW()' : '';
  const [result] = await pool.query(
    `UPDATE orders SET status = ?${setPaid} WHERE id = ?`,
    [status, id]
  );
  if (!result.affectedRows) return null;
  return getById(id);
}

function safeJson(v) {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return []; }
  }
  return v;
}

module.exports = { create, getById, getAll, getMine, updateStatus, ALLOWED_STATUSES };