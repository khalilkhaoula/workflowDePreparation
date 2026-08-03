const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/options.controller');

router.use(requireAuth);

router.get('/:optionId/sous-options', controller.sousOptions);

router.get('/par-modele/:modele', controller.parModele);
module.exports = router;
