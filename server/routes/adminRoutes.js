const express = require('express');
const statsController = require('../controllers/statsController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/* Все эндпоинты /api/admin/* — только для админа */
router.use(requireAuth, requireAdmin);

/* GET /api/admin/stats */
router.get('/stats', statsController.dashboard);

module.exports = router;