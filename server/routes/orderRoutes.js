const express = require('express');
const controller = require('../controllers/orderController');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/authMiddleware');

const router = express.Router();

/* Создание заказа — доступно и гостям, и авторизованным.
   Гость: user_id = NULL. Авторизованный: user_id = req.user.id. */
router.post('/', optionalAuth, controller.create);

/* Список всех заказов — только админ */
router.get('/', requireAuth, requireAdmin, controller.list);

/* Просмотр заказа — владелец или админ (проверка внутри контроллера) */
router.get('/:id', requireAuth, controller.getOne);

/* Смена статуса — только админ */
router.patch('/:id/status', requireAuth, requireAdmin, controller.updateStatus);

module.exports = router;