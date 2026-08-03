const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const controller = require('../controllers/utilisateurs.controller');

router.use(requireAuth);
router.get('/moi', controller.moi);
router.patch('/moi', controller.modifierProfil);
router.patch('/moi/mot-de-passe', controller.changerMotDePasse);
router.get('/techniciens', controller.listTechniciens);

router.use(requireRole('admin'));
router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id/statut', controller.setStatut);

module.exports = router;
