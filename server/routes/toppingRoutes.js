const express = require('express');
const c = require('../controllers/toppingController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/* Публичный список (активные + не истёкшие) */
router.get('/', c.listPublic);

/* Админский список — все */
router.get('/admin', requireAuth, requireAdmin, c.listAdmin);

router.post('/',  requireAuth, requireAdmin, c.create);
router.put('/:id', requireAuth, requireAdmin, c.update);
router.delete('/:id', requireAuth, requireAdmin, c.remove);

module.exports = router;