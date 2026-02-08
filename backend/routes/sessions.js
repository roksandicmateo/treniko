const express = require('express');
const router = express.Router();
const sessionsController = require('../controllers/sessionsController');
const { authenticateToken } = require('../middleware/auth');

// All session routes require authentication
router.use(authenticateToken);

/**
 * GET /api/sessions
 * Get all sessions for the authenticated tenant
 * Query params: startDate, endDate, clientId
 */
router.get('/', sessionsController.getSessions);

/**
 * GET /api/sessions/:id
 * Get a single session by ID
 */
router.get('/:id', sessionsController.getSessionById);

/**
 * POST /api/sessions
 * Create a new training session
 */
router.post('/', sessionsController.createSession);

/**
 * PUT /api/sessions/:id
 * Update an existing session
 */
router.put('/:id', sessionsController.updateSession);

/**
 * DELETE /api/sessions/:id
 * Delete a training session
 */
router.delete('/:id', sessionsController.deleteSession);

module.exports = router;
