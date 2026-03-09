// backend/routes/consent.js  (NEW FILE)

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :id from parent
const { giveConsent, withdrawConsent, getConsent } = require('../controllers/consentController');
const { authenticateToken } = require('../middleware/auth');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);

// GET    /api/clients/:id/consent
router.get('/', getConsent);

// POST   /api/clients/:id/consent
router.post('/', giveConsent);

// DELETE /api/clients/:id/consent
router.delete('/', withdrawConsent);

module.exports = router;
