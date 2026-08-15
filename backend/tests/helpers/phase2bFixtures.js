'use strict';

/**
 * Additional fixtures for the Phase 2B security suites.
 *
 * Kept separate from `fixtures.js` so the Phase 2A helper that seven existing
 * suites depend on is not modified. Everything here builds on a tenant already
 * created by `createTenant`, and is removed by that tenant's `destroyTenant`
 * (all rows are tenant-scoped or cascade from a tenant-scoped parent).
 */

const { pool, TEST_MARKER } = require('./fixtures');

/** A catalogue exercise owned by one tenant. */
const createExercise = async (tenantId, name = 'Bench Press') => {
  const { rows: [ex] } = await pool.query(
    `INSERT INTO exercises (tenant_id, name, category, default_unit)
     VALUES ($1, $2, 'Strength', 'kg') RETURNING id, name`,
    [tenantId, `${TEST_MARKER} ${name}`]
  );
  return ex;
};

/** An individual (non-group) training session. */
const createSession = async (tenantId, clientId) => {
  const { rows: [s] } = await pool.query(
    `INSERT INTO training_sessions (tenant_id, client_id, session_date, start_time, end_time)
     VALUES ($1, $2, CURRENT_DATE, '12:00', '13:00') RETURNING id`,
    [tenantId, clientId]
  );
  return s;
};

/** A package, an assignment of it to a client, and a payment against it. */
const createPackageWithPayment = async (tenantId, clientId) => {
  const { rows: [pkg] } = await pool.query(
    `INSERT INTO packages (tenant_id, name, package_type, total_sessions, price)
     VALUES ($1, $2, 'sessions', 10, 100) RETURNING id`,
    [tenantId, `${TEST_MARKER} package`]
  );
  const { rows: [clientPackage] } = await pool.query(
    `INSERT INTO client_packages
       (tenant_id, client_id, package_id, package_name, package_type, total_sessions, price)
     VALUES ($1, $2, $3, $4, 'sessions', 10, 100) RETURNING id`,
    [tenantId, clientId, pkg.id, `${TEST_MARKER} package`]
  );
  const { rows: [payment] } = await pool.query(
    `INSERT INTO client_payments
       (tenant_id, client_id, client_package_id, amount, payment_date, payment_method, status)
     VALUES ($1, $2, $3, 50, CURRENT_DATE, 'cash', 'paid') RETURNING id`,
    [tenantId, clientId, clientPackage.id]
  );
  return { packageId: pkg.id, clientPackageId: clientPackage.id, paymentId: payment.id };
};

/** Put a tenant on a named plan (e.g. 'pro') so feature gates open. */
const setPlan = async (tenantId, planName) => {
  const { rows: [plan] } = await pool.query(
    'SELECT id FROM subscription_plans WHERE name = $1',
    [planName]
  );
  await pool.query(
    'UPDATE tenant_subscriptions SET plan_id = $1 WHERE tenant_id = $2',
    [plan.id, tenantId]
  );
};

module.exports = { createExercise, createSession, createPackageWithPayment, setPlan };
