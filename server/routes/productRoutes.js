const express = require('express');
const controller = require('../controllers/productController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id', controller.getOne);

/* Админские операции — с авторизацией */
router.post('/', requireAuth, requireAdmin, controller.create);
router.put('/:id', requireAuth, requireAdmin, controller.update);
router.delete('/:id', requireAuth, requireAdmin, controller.remove);

module.exports = router;