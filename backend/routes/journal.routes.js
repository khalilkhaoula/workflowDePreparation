const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const controller = require('../controllers/journal.controller');

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);

module.exports = router;
