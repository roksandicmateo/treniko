'use strict';

/**
 * Test fixtures for the Phase 2A security suite.
 *
 * Builds two fully independent tenants ("Trainer A" and "Trainer B") so that
 * cross-tenant attacks can be exercised against real data through the real
 * Express stack and a real PostgreSQL database.
 *
 * SAFETY: every row created here is tracked by tenant id and removed again in
 * `destroyTenant`. Nothing pre-existing in the database is read, modified or
 * deleted — cleanup only ever targets the tenant ids this module created.
 */

require('dotenv').config();

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../../config/database');

// Marker so any row that somehow survives cleanup is obviously test data.
const TEST_MARKER = 'sec2a-test';

const FREE_PLAN = 'free';

/**
 * Create an isolated tenant with a trainer, a subscription, a client, a group,
 * a group session and an attendance row.
 *
 * @param {string} label short label used in names/emails, e.g. 'a'
 * @returns {Promise<object>} ids + a signed JWT for the tenant's trainer
 */
const createTenant = async (label) => {
  const unique = `${TEST_MARKER}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { rows: [tenant] } = await pool.query(
    'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
    [`${TEST_MARKER} tenant ${label}`]
  );
  const tenantId = tenant.id;

  const password = 'TestPassw0rd!';
  const passwordHash = await bcrypt.hash(password, 4); // low cost: tests only
  const { rows: [user] } = await pool.query(
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, dpa_accepted, dpa_accepted_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW()) RETURNING id`,
    [tenantId, `${unique}@example.test`, passwordHash, 'Test', `Trainer${label.toUpperCase()}`]
  );
  const userId = user.id;

  // A subscription must exist or checkReadOnlyMode rejects every write.
  const { rows: [plan] } = await pool.query(
    'SELECT id FROM subscription_plans WHERE name = $1',
    [FREE_PLAN]
  );
  await pool.query(
    `INSERT INTO tenant_subscriptions
       (tenant_id, plan_id, status, billing_period, current_period_start, current_period_end, is_trial)
     VALUES ($1, $2, 'active', 'monthly', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', false)`,
    [tenantId, plan.id]
  );
  await pool.query(
    `INSERT INTO subscription_usage (tenant_id, period_start, period_end, clients_count, sessions_count)
     VALUES ($1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 0, 0)`,
    [tenantId]
  );

  const { rows: [client] } = await pool.query(
    `INSERT INTO clients (tenant_id, first_name, last_name, email)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [tenantId, 'Client', label.toUpperCase(), `${unique}-client@example.test`]
  );

  const { rows: [group] } = await pool.query(
    'INSERT INTO groups (tenant_id, name) VALUES ($1, $2) RETURNING id',
    [tenantId, `${TEST_MARKER} group ${label}`]
  );

  await pool.query(
    'INSERT INTO group_members (group_id, client_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [group.id, client.id]
  );

  const { rows: [groupSession] } = await pool.query(
    `INSERT INTO group_sessions (tenant_id, group_id, session_date, start_time, end_time)
     VALUES ($1, $2, CURRENT_DATE, '10:00', '11:00') RETURNING id`,
    [tenantId, group.id]
  );

  const { rows: [attendance] } = await pool.query(
    `INSERT INTO group_session_attendance (group_session_id, client_id, status)
     VALUES ($1, $2, 'scheduled') RETURNING id, status`,
    [groupSession.id, client.id]
  );

  const { rows: [training] } = await pool.query(
    `INSERT INTO trainings (tenant_id, client_id, title, start_time, end_time)
     VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 hour') RETURNING id`,
    [tenantId, client.id, `${TEST_MARKER} training ${label}`]
  );

  return {
    tenantId,
    userId,
    email: `${unique}@example.test`,
    password,
    clientId: client.id,
    groupId: group.id,
    groupSessionId: groupSession.id,
    attendanceId: attendance.id,
    trainingId: training.id,
    token: signToken({ userId, tenantId, email: `${unique}@example.test` }),
  };
};

/**
 * Sign a JWT the same way authController does.
 * @param {object} payload
 * @param {object} [options] passed through to jwt.sign (e.g. to backdate iat)
 */
const signToken = (payload, options = {}) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h', ...options });

/**
 * Remove a tenant and everything cascading from it.
 * Only ever called with ids produced by createTenant.
 */
const destroyTenant = async (tenantId) => {
  if (!tenantId) return;
  // Rows that reference the trainer rather than the tenant, and so are not
  // covered by the tenants cascade.
  await pool.query(
    'DELETE FROM audit_log WHERE trainer_id IN (SELECT id FROM users WHERE tenant_id = $1)',
    [tenantId]
  );
  await pool.query(
    'DELETE FROM deletion_requests WHERE trainer_id IN (SELECT id FROM users WHERE tenant_id = $1)',
    [tenantId]
  );

  // Usage-tracking triggers write back to subscription_usage when clients and
  // sessions are removed. If those deletes happen as part of the tenants
  // cascade the trigger fires against an already-deleted tenant and trips the
  // subscription_usage foreign key, so clear them while the tenant still
  // exists, then drop the usage row itself.
  await pool.query('DELETE FROM training_sessions WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM clients WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM subscription_usage WHERE tenant_id = $1', [tenantId]);

  await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
};

module.exports = { createTenant, destroyTenant, signToken, pool, TEST_MARKER };
