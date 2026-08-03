const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/utilisateurs', require('./utilisateurs.routes'));
router.use('/clients', require('./clients.routes'));
router.use('/engins', require('./engins.routes'));
router.use('/options', require('./options.routes'));
router.use('/demandes', require('./demandes.routes'));
router.use('/demande-options', require('./demandeOptions.routes'));
router.use('/notifications', require('./notifications.routes'));
router.use('/journal', require('./journal.routes'));

router.use('/dashboard', require('./dashboard.routes'));
module.exports = router;
