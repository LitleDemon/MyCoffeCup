const express = require('express');
const c = require('../controllers/orderController');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', optionalAuth, c.create);
router.get('/', requireAuth, requireAdmin, c.list);
router.get('/mine', requireAuth, c.mine);   // важно: до /:id
router.get('/:id', requireAuth, c.getOne);
router.patch('/:id/status', requireAuth, requireAdmin, c.updateStatus);

module.exports = router;