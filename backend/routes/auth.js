const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', authController.login);

/**
 * POST /api/auth/register
 * Register a new user and tenant
 */
router.post('/register', authController.register);

/**
 * GET /api/auth/validate
 * Validate current token
 */
router.get('/validate', authenticateToken, authController.validateToken);

module.exports = router;
