const express = require('express');
const router = express.Router();
const trainingLogsController = require('../controllers/trainingLogsController');
const { authenticateToken } = require('../middleware/auth');

// All training log routes require authentication
router.use(authenticateToken);

/**
 * GET /api/training-logs/session/:sessionId
 * Get training log for a specific session
 */
router.get('/session/:sessionId', trainingLogsController.getTrainingLog);

/**
 * POST /api/training-logs/session/:sessionId
 * Create or update training log for a session
 */
router.post('/session/:sessionId', trainingLogsController.saveTrainingLog);

/**
 * DELETE /api/training-logs/session/:sessionId
 * Delete training log for a session
 */
router.delete('/session/:sessionId', trainingLogsController.deleteTrainingLog);

/**
 * GET /api/training-logs/client/:clientId/exercise-stats
 * Get exercise statistics for a client
 */
router.get('/client/:clientId/exercise-stats', trainingLogsController.getClientExerciseStats);

/**
 * GET /api/training-logs/client/:clientId/completion-stats
 * Get training completion statistics for a client
 */
router.get('/client/:clientId/completion-stats', trainingLogsController.getCompletionStats);

module.exports = router;
