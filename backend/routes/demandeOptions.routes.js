const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/demandeOptions.controller');

router.use(requireAuth);

router.patch('/:id/annuler-planification', controller.annulerPlanification);
router.get('/mes-options', controller.mesOptions);
router.get('/par-periode', controller.parPeriode);
router.patch('/:id/planifier', controller.planifier);
router.patch('/:id/terminer', controller.terminer);

module.exports = router;
