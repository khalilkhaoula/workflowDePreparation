const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
console.log(require.resolve('../controllers/dashboard.controller'));

const controller = require('../controllers/dashboard.controller');
router.use(requireAuth, requireRole('admin', 'responsable technique', 'assistant technique'));
router.get('/stats', controller.stats);

module.exports = router;
