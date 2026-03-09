// backend/routes/profile.js  (NEW FILE)

const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword } = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/password', changePassword);

module.exports = router;
