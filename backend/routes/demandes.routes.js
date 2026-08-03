const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/demandes.controller');
const pdfController = require('../controllers/pdf.controller');

router.use(requireAuth);

router.get('/', controller.list);

router.delete('/:reference', controller.supprimer);
router.get('/:reference/detail', controller.getDetail);
router.post('/', controller.create);
router.patch('/:reference', controller.update);
router.patch('/:reference/envoyer', controller.envoyer);
router.post('/export-pdf', pdfController.exportDemandePdf);

module.exports = router;
