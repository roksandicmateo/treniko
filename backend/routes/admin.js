'use strict';

/**
 * Platform administration routes — mounted at /api/admin.
 *
 * ── Where this sits in server.js, and why it matters ────────────────────────
 * This router is mounted BEFORE the trainer authentication gate and BEFORE the
 * tenant-context middleware. Two consequences, both deliberate:
 *
 *   1. The trainer gate never sees these requests, so an administrator does not
 *      need a trainer account to reach them.
 *   2. **No tenant context is ever established for an admin request.** Under the
 *      `treniko_app` runtime role that means every RLS-protected table — clients,
 *      training_sessions, client_payments, training_logs, progress_entries —
 *      returns zero rows to this API. The admin surface is therefore
 *      default-denied from tenant business data by the database itself, not by
 *      a rule someone has to remember in each controller.
 *
 * Rate limiting and the request audit log still apply: both are mounted on
 * '/api' above this point.
 *
 * ── Authorization ───────────────────────────────────────────────────────────
 *   viewer  read everything this API exposes
 *   admin   + update tenants, trainers and subscriptions
 *   owner   + create and manage administrators
 */

const express = require('express');
const router = express.Router();

const admin = require('../controllers/adminController');
const { authenticateAdmin, requireAdminRole } = require('../middleware/adminAuth');
const { authRateLimiter } = require('../middleware/security');

// ── Public: the administrator login ─────────────────────────────────────────
// Shares the trainer auth limiter's budget shape — this is the highest-value
// credential in the system and must not be brute-forceable.
router.post('/auth/login', authRateLimiter, admin.login);

// ── Everything below requires a verified, active administrator ──────────────
router.use(authenticateAdmin);

router.get('/auth/me', admin.me);

// ── Read: any role ──────────────────────────────────────────────────────────
router.get('/overview', admin.getOverview);

router.get('/tenants', admin.listTenants);
router.get('/tenants/:id', admin.getTenant);

router.get('/trainers', admin.listTrainers);
router.get('/trainers/:id', admin.getTrainer);

router.get('/audit', admin.listAuditLog);

// ── Write: admin or owner ───────────────────────────────────────────────────
router.patch('/tenants/:id', requireAdminRole('admin'), admin.updateTenant);
router.patch('/tenants/:id/subscription', requireAdminRole('admin'), admin.updateTenantSubscription);

router.patch('/trainers/:id', requireAdminRole('admin'), admin.updateTrainer);
router.post('/trainers/:id/unlock', requireAdminRole('admin'), admin.unlockTrainer);
router.post('/trainers/:id/verify-email', requireAdminRole('admin'), admin.verifyTrainerEmail);

// ── Administrator management: owner only ────────────────────────────────────
router.get('/admins', requireAdminRole('owner'), admin.listAdmins);
router.post('/admins', requireAdminRole('owner'), admin.createAdmin);
router.patch('/admins/:id', requireAdminRole('owner'), admin.updateAdmin);

module.exports = router;
