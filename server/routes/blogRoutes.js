const express = require('express');
const controller = require('../controllers/blogController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/* Публичные: чтение доступно всем */
router.get('/', controller.list);
router.get('/:id', controller.getOne);

/* Админские: создание, редактирование, удаление */
router.post('/', requireAuth, requireAdmin, controller.create);
router.put('/:id', requireAuth, requireAdmin, controller.update);
router.delete('/:id', requireAuth, requireAdmin, controller.remove);

module.exports = router;