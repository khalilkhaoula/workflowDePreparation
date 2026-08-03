const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/notifications.controller');

router.use(requireAuth);

router.get('/', controller.list);
router.patch('/:id/lue', controller.marquerLue);
router.patch('/tout-marquer-lu', controller.toutMarquerLu);

module.exports = router;
