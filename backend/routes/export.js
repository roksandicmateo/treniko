// backend/routes/export.js  (NEW FILE)

const express = require('express');
const router = express.Router();
const { exportAllData, exportClientData } = require('../controllers/exportController');
const { authenticateToken } = require('../middleware/auth');
const { attachUuidParamGuards } = require('../utils/routeGuards');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);

// A malformed UUID in the path answers 404 instead of reaching PostgreSQL
// and surfacing as a 500 (see utils/routeGuards.js).
attachUuidParamGuards(router);

// GET /api/export           — full trainer data export
router.get('/', exportAllData);

// GET /api/clients/:id/export — single client export
router.get('/clients/:id', exportClientData);

module.exports = router;
