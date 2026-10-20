const Order = require('../models/orderModel');

async function create(req, res, next) {
  try {
    const { items, stickers, payment_method } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'В заказе нет товаров' });
    }
    const user = req.user || null;
    const order = await Order.create({
      userId: user?.id || null,
      customerName: user?.name || req.body.customer_name?.trim() || 'Гость',
      customerEmail: user?.email || req.body.customer_email?.trim() || null,
      items,
      stickers: Array.isArray(stickers) ? stickers : null,
      paymentMethod: payment_method || 'onsite',
    });
    res.status(201).json(order);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const orders = await Order.getAll({ status: req.query.status });
    res.json({ orders, count: orders.length });
  } catch (err) { next(err); }
}

async function mine(req, res, next) {
  try {
    const orders = await Order.getMine(req.user.id);
    res.json({ orders });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const order = await Order.getById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Заказ не найден' });
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Нет доступа к этому заказу' });
    }
    res.json(order);
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ message: 'Поле status обязательно' });
    const order = await Order.updateStatus(req.params.id, status);
    if (!order) return res.status(404).json({ message: 'Заказ не найден' });
    res.json(order);
  } catch (err) { next(err); }
}

module.exports = { create, list, mine, getOne, updateStatus };