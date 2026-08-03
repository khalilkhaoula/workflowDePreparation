const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/clients.controller');

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', controller.create);

module.exports = router;
