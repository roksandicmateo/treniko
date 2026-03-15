// backend/routes/dashboard.js  (NEW FILE)

const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);

router.get('/', getDashboard);

module.exports = router;
