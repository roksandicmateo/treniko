const express = require('express');
const router = express.Router();
const clientsController = require('../controllers/clientsController');
const { authenticateToken } = require('../middleware/auth');

// All client routes require authentication
router.use(authenticateToken);

/**
 * GET /api/clients
 * Get all clients for the authenticated tenant
 * Query params: search, isActive
 */
router.get('/', clientsController.getAllClients);

/**
 * GET /api/clients/:id
 * Get a single client by ID with full details
 */
router.get('/:id', clientsController.getClientById);

/**
 * GET /api/clients/:id/sessions
 * Get all training sessions for a specific client
 * Query params: startDate, endDate, limit
 */
router.get('/:id/sessions', clientsController.getClientSessions);

/**
 * POST /api/clients
 * Create a new client
 */
router.post('/', clientsController.createClient);

/**
 * PUT /api/clients/:id
 * Update an existing client
 */
router.put('/:id', clientsController.updateClient);

/**
 * DELETE /api/clients/:id
 * Delete a client (hard delete)
 */
router.delete('/:id', clientsController.deleteClient);

/**
 * PATCH /api/clients/:id/deactivate
 * Soft delete a client (deactivate)
 */
router.patch('/:id/deactivate', clientsController.deactivateClient);

module.exports = router;
