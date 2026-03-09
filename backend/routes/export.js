// backend/routes/export.js  (NEW FILE)

const express = require('express');
const router = express.Router();
const { exportAllData, exportClientData } = require('../controllers/exportController');
const { authenticateToken } = require('../middleware/auth');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);

// GET /api/export           — full trainer data export
router.get('/', exportAllData);

// GET /api/clients/:id/export — single client export
router.get('/clients/:id', exportClientData);

module.exports = router;
