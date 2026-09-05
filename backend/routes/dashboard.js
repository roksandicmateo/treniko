// backend/routes/dashboard.js  (NEW FILE)

const express = require('express');
const router = express.Router();
const { getDashboard, getOnboarding } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);

router.get('/', getDashboard);
router.get('/onboarding', getOnboarding);

module.exports = router;
