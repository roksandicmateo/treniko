// backend/routes/deletion.js  (NEW FILE)

const express = require('express');
const router = express.Router();
const {
  requestAccountDeletion,
  cancelAccountDeletion,
  getAccountDeletionStatus,
  requestClientDeletion,
  cancelClientDeletion
} = require('../controllers/deletionController');
const { authenticateToken } = require('../middleware/auth');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);

// Account deletion
router.post('/account/request-deletion', requestAccountDeletion);
router.post('/account/cancel-deletion', cancelAccountDeletion);
router.get('/account/deletion-status', getAccountDeletionStatus);

// Client deletion
router.post('/clients/:id/request-deletion', requestClientDeletion);
router.post('/clients/:id/cancel-deletion', cancelClientDeletion);

module.exports = router;
