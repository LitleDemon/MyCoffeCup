const Stats = require('../models/statsModel');

/* ---------- GET /api/admin/stats ---------- */
async function dashboard(req, res, next) {
  try {
    const stats = await Stats.getDashboardStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard };