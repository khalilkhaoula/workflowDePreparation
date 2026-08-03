const express = require('express');
const router = express.Router();
const controller = require('../controllers/engins.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
router.use(requireAuth);

router.get('/marque-par-modele/:modele', controller.marqueParModele);
router.get('/marques', controller.marques);
router.get('/modeles', controller.modeles);
router.get('/mats', controller.mats);
router.get('/pipings', controller.pipings);
router.get('/series', controller.series);
router.get('/catalogue', controller.catalogue);
router.get('/options-existantes', controller.optionsExistantes);
router.get('/sous-options-existantes', controller.sousOptionsExistantes);
router.get('/pieces-existantes', controller.piecesExistantes);
router.post('/', requireRole('admin'), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getOne);

module.exports = router;
