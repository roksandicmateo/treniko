// backend/routes/consent.js  (NEW FILE)

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :id from parent
const { giveConsent, withdrawConsent, getConsent } = require('../controllers/consentController');
const { authenticateToken } = require('../middleware/auth');
const { attachUuidParamGuards, guardInheritedUuidParams } = require('../utils/routeGuards');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);

// A malformed UUID in the path answers 404 instead of reaching PostgreSQL
// and surfacing as a 500. These routers are mounted beneath a
// parameterised path, so the inherited ids are checked as middleware while
// the router's own ids go through router.param (see utils/routeGuards.js).
attachUuidParamGuards(router);
router.use(guardInheritedUuidParams(['id']));

// GET    /api/clients/:id/consent
router.get('/', getConsent);

// POST   /api/clients/:id/consent
router.post('/', giveConsent);

// DELETE /api/clients/:id/consent
router.delete('/', withdrawConsent);

module.exports = router;
