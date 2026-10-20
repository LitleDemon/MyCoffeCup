const express = require('express');
const upload = require('../middleware/upload');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Файл не получен' });
  }
  res.json({ url: '/uploads/' + req.file.filename });
});

module.exports = router;