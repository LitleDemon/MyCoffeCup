const pool = require('../config/db');

/**
 * Возвращает KPI и данные для графиков за последние 30 дней.
 * Исключает отменённые заказы (status = 'cancelled').
 */
async function getDashboardStats() {
  const [revenueRows] = await pool.query(`
    SELECT
      COALESCE(SUM(total), 0)  AS revenue,
      COUNT(*)                 AS orders
    FROM orders
    WHERE status <> 'cancelled'
      AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `);

  const revenue = Number(revenueRows[0].revenue) || 0;
  const orders = Number(revenueRows[0].orders) || 0;
  const avgCheck = orders > 0 ? revenue / orders : 0;

  const [usersRows] = await pool.query(`
    SELECT COUNT(*) AS newUsers
    FROM users
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `);
  const newUsers = Number(usersRows[0].newUsers) || 0;

  // Продажи по дням за последние 7 дней (включая сегодня).
  // DATE_FORMAT возвращает строку, чтобы не зависеть от часового пояса Node.
  const [salesRows] = await pool.query(`
    SELECT
      DATE_FORMAT(created_at, '%Y-%m-%d') AS day,
      COALESCE(SUM(total), 0) AS value
    FROM orders
    WHERE status <> 'cancelled'
      AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
  `);

  // Топ-5 товаров по количеству проданных штук
  const [topRows] = await pool.query(`
    SELECT oi.name, SUM(oi.qty) AS value
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status <> 'cancelled'
    GROUP BY oi.name
    ORDER BY value DESC
    LIMIT 5
  `);

  return {
    revenue,
    orders,
    avgCheck: Math.round(avgCheck),
    newUsers,
    salesByDay: buildWeeklyChart(salesRows),
    topProducts: topRows.map((r) => ({
      name: r.name,
      value: Number(r.value) || 0,
    })),
  };
}

/* Заполняет пропущенные дни нулями и раскладывает в Пн..Вс */
function buildWeeklyChart(rows) {
  const RU_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const byDate = new Map(rows.map((r) => [r.day, Number(r.value) || 0]));

  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    result.push({
      day: RU_DAYS[d.getDay()],
      value: byDate.get(key) || 0,
    });
  }
  return result;
}

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { getDashboardStats };