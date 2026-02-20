const express = require('express');
const router = express.Router();
const subscriptionsController = require('../controllers/subscriptionsController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

/**
 * GET /api/subscriptions/status
 * Get current subscription status for tenant
 */
router.get('/status', subscriptionsController.getSubscriptionStatus);

/**
 * GET /api/subscriptions/plans
 * Get all available subscription plans
 */
router.get('/plans', subscriptionsController.getSubscriptionPlans);

/**
 * GET /api/subscriptions/check/:resource
 * Check if tenant can perform action (limit enforcement)
 * Resources: clients, sessions, training_logs, analytics
 */
router.get('/check/:resource', subscriptionsController.checkLimit);

/**
 * GET /api/subscriptions/notifications
 * Get subscription notifications for tenant
 */
router.get('/notifications', subscriptionsController.getNotifications);

/**
 * PATCH /api/subscriptions/notifications/:notificationId/read
 * Mark notification as read
 */
router.patch('/notifications/:notificationId/read', subscriptionsController.markNotificationRead);

/**
 * POST /api/subscriptions/change-plan
 * Change subscription plan (upgrade/downgrade)
 */
router.post('/change-plan', subscriptionsController.changePlan);

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription
 */
router.post('/cancel', subscriptionsController.cancelSubscription);

module.exports = router;
