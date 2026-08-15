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
const { attachUuidParamGuards } = require('../utils/routeGuards');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);

// A malformed UUID in the path answers 404 instead of reaching PostgreSQL
// and surfacing as a 500 (see utils/routeGuards.js).
attachUuidParamGuards(router);

// Account deletion
router.post('/account/request-deletion', requestAccountDeletion);
router.post('/account/cancel-deletion', cancelAccountDeletion);
router.get('/account/deletion-status', getAccountDeletionStatus);

// Client deletion
router.post('/clients/:id/request-deletion', requestClientDeletion);
router.post('/clients/:id/cancel-deletion', cancelClientDeletion);

module.exports = router;
