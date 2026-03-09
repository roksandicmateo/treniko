// backend/routes/dpa.js  (NEW FILE)
// Add these two lines to your existing backend/routes/auth.js
// OR create this as a separate file and mount it in server.js

const express = require('express');
const router = express.Router();
const { acceptDpa, getDpaStatus } = require('../controllers/dpaController');
const { authenticateToken } = require('../middleware/auth');

// Both routes require a valid JWT but NOT dpa acceptance
// (you can't accept the DPA if the route itself blocks you)
router.post('/accept-dpa', authenticateToken, acceptDpa);
router.get('/dpa-status', authenticateToken, getDpaStatus);

module.exports = router;
