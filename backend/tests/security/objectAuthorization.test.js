'use strict';

/**
 * Object-level and object-property authorization — adversarial tests (Phase 2B).
 *
 * Covers OWASP API1 (broken object level authorization) and API3 (broken object
 * property level authorization) for the four MEDIUM findings in that family:
 *
 *   TR-MED-4  exercise references written without an ownership check
 *   TR-MED-5  a payment re-pointed at another tenant's client package
 *   TR-MED-6  ad-hoc session attendees inserted without checking either id
 *   TR-MED-7  progress entries filed against an unverified client id
 *
 * Trainer A is always the attacker and always presents a legitimate token of
 * their own; only the ids in the request are swapped for Trainer B's. Every
 * assertion checks the database as well as the status code, because "returned
 * 404" and "changed nothing" are different claims.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool } = require('../helpers/fixtures');
const {
  createExercise, createSession, createPackageWithPayment,
} = require('../helpers/phase2bFixtures');

jest.setTimeout(30000);

const ABSENT_UUID = '00000000-0000-4000-8000-000000000000';

let A;
let B;
let exerciseA;
let exerciseB;
let sessionA;
let sessionB;
let paymentsA;
let paymentsB;

beforeAll(async () => {
  A = await createTenant('a');
  B = await createTenant('b');
  exerciseA = await createExercise(A.tenantId, 'A Squat');
  exerciseB = await createExercise(B.tenantId, 'B Secret Lift');
  sessionA = await createSession(A.tenantId, A.clientId);
  sessionB = await createSession(B.tenantId, B.clientId);
  paymentsA = await createPackageWithPayment(A.tenantId, A.clientId);
  paymentsB = await createPackageWithPayment(B.tenantId, B.clientId);
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

const asA = (req) => req.set('Authorization', `Bearer ${A.token}`);

// ── TR-MED-4 ────────────────────────────────────────────────────────────────
describe('TR-MED-4: exercise references must belong to the caller', () => {
  test('POST /api/templates rejects another tenant exerciseId', async () => {
    const res = await asA(request(app).post('/api/templates')).send({
      name: 'attack template',
      exercises: [{ exerciseId: exerciseB.id, sets: [{ reps: 5 }] }],
    });

    expect(res.status).toBe(400);

    // Nothing may be written — not the template, not the reference.
    const templates = await pool.query(
      'SELECT id FROM training_templates WHERE tenant_id = $1',
      [A.tenantId]
    );
    expect(templates.rows).toHaveLength(0);

    const refs = await pool.query(
      'SELECT id FROM template_exercises WHERE exercise_id = $1',
      [exerciseB.id]
    );
    expect(refs.rows).toHaveLength(0);
  });

  test('POST /api/trainings rejects another tenant exerciseId and leaks no metadata', async () => {
    const res = await asA(request(app).post('/api/trainings')).send({
      clientId: A.clientId,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      exercises: [{ exerciseId: exerciseB.id }],
    });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('Secret Lift');

    const refs = await pool.query(
      'SELECT id FROM training_exercises WHERE exercise_id = $1',
      [exerciseB.id]
    );
    expect(refs.rows).toHaveLength(0);
  });

  test('PUT /api/trainings/:id rejects another tenant exerciseId', async () => {
    const res = await asA(request(app).put(`/api/trainings/${A.trainingId}`)).send({
      exercises: [{ exerciseId: exerciseB.id }],
    });

    expect(res.status).toBe(400);
    const refs = await pool.query(
      'SELECT id FROM training_exercises WHERE exercise_id = $1',
      [exerciseB.id]
    );
    expect(refs.rows).toHaveLength(0);
  });

  test('a malformed exerciseId is a 400, not a 500 (no error-based disclosure)', async () => {
    const res = await asA(request(app).post('/api/templates')).send({
      name: 'malformed',
      exercises: [{ exerciseId: 'not-a-uuid; DROP TABLE users;--' }],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/syntax|postgres|invalid input/i);
  });

  test('an unknown-but-valid exerciseId is refused the same way as a foreign one', async () => {
    const foreign = await asA(request(app).post('/api/templates')).send({
      name: 't1', exercises: [{ exerciseId: exerciseB.id }],
    });
    const absent = await asA(request(app).post('/api/templates')).send({
      name: 't2', exercises: [{ exerciseId: ABSENT_UUID }],
    });
    expect(foreign.status).toBe(absent.status);
    expect(foreign.body).toEqual(absent.body);
  });

  test('the tenant own exercise is still accepted (no over-blocking)', async () => {
    const res = await asA(request(app).post('/api/templates')).send({
      name: 'legitimate template',
      exercises: [{ exerciseId: exerciseA.id, sets: [{ reps: 8, weight: 60 }] }],
    });
    expect(res.status).toBe(201);

    const read = await asA(request(app).get(`/api/templates/${res.body.id}`));
    expect(read.status).toBe(200);
    expect(read.body.exercises).toHaveLength(1);
    expect(read.body.exercises[0].exercise_name).toContain('A Squat');
  });
});

// ── TR-MED-5 ────────────────────────────────────────────────────────────────
describe('TR-MED-5: payments cannot be re-linked to a foreign package', () => {
  test('updating a payment with another tenant clientPackageId is refused', async () => {
    const res = await asA(
      request(app).put(`/api/clients/${A.clientId}/payments/${paymentsA.paymentId}`)
    ).send({ amount: 75, clientPackageId: paymentsB.clientPackageId });

    expect(res.status).toBe(404);

    // Neither the link nor the amount may have moved.
    const row = await pool.query(
      'SELECT amount, client_package_id FROM client_payments WHERE id = $1',
      [paymentsA.paymentId]
    );
    expect(row.rows[0].client_package_id).toBe(paymentsA.clientPackageId);
    expect(Number(row.rows[0].amount)).toBe(50);
  });

  test('a malformed clientPackageId is a 400, not a 500', async () => {
    const res = await asA(
      request(app).put(`/api/clients/${A.clientId}/payments/${paymentsA.paymentId}`)
    ).send({ clientPackageId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  test('the tenant own package link is still accepted', async () => {
    const res = await asA(
      request(app).put(`/api/clients/${A.clientId}/payments/${paymentsA.paymentId}`)
    ).send({ amount: 80, clientPackageId: paymentsA.clientPackageId });

    expect(res.status).toBe(200);
    const row = await pool.query(
      'SELECT amount FROM client_payments WHERE id = $1',
      [paymentsA.paymentId]
    );
    expect(Number(row.rows[0].amount)).toBe(80);
  });
});

// ── TR-MED-6 ────────────────────────────────────────────────────────────────
describe('TR-MED-6: ad-hoc session attendees', () => {
  test('A cannot attach anyone to B session', async () => {
    const res = await asA(request(app).post(`/api/sessions/${sessionB.id}/attendees`))
      .send({ clientId: A.clientId });

    expect(res.status).toBe(404);
    const rows = await pool.query(
      'SELECT id FROM session_attendees WHERE session_id = $1',
      [sessionB.id]
    );
    expect(rows.rows).toHaveLength(0);
  });

  test('A cannot attach B client to A own session, and cannot read B client name back', async () => {
    const res = await asA(request(app).post(`/api/sessions/${sessionA.id}/attendees`))
      .send({ clientId: B.clientId });

    expect(res.status).toBe(404);

    // The original defect: the row was written with A's tenant_id but B's
    // client_id, and the listing endpoint then joined `clients` without a
    // tenant filter — returning B's client's name to A.
    const rows = await pool.query(
      'SELECT id FROM session_attendees WHERE session_id = $1 AND client_id = $2',
      [sessionA.id, B.clientId]
    );
    expect(rows.rows).toHaveLength(0);

    const list = await asA(request(app).get(`/api/sessions/${sessionA.id}/attendees`));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain('Client B');
  });

  test('the listing endpoint refuses to surface a foreign client even from a poisoned row', async () => {
    // Simulate the exact row the old insert would have produced, bypassing the
    // API, and prove the read path alone now refuses to leak the name.
    await pool.query(
      `INSERT INTO session_attendees (session_id, client_id, tenant_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [sessionA.id, B.clientId, A.tenantId]
    );

    const list = await asA(request(app).get(`/api/sessions/${sessionA.id}/attendees`));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain('Client B');

    await pool.query(
      'DELETE FROM session_attendees WHERE session_id = $1 AND client_id = $2',
      [sessionA.id, B.clientId]
    );
  });

  test('a malformed session id is refused as a client error, not a 500', async () => {
    // The router-level UUID guard answers first, with the same 404 an id owned
    // by another tenant would get, so the two cannot be told apart.
    const res = await asA(request(app).post('/api/sessions/not-a-uuid/attendees'))
      .send({ clientId: A.clientId });
    expect(res.status).toBe(404);
  });

  test('a malformed clientId in the body is refused as a client error', async () => {
    const res = await asA(request(app).post(`/api/sessions/${sessionA.id}/attendees`))
      .send({ clientId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  test('adding your own client to your own session still works', async () => {
    const res = await asA(request(app).post(`/api/sessions/${sessionA.id}/attendees`))
      .send({ clientId: A.clientId });
    expect(res.status).toBe(200);

    const list = await asA(request(app).get(`/api/sessions/${sessionA.id}/attendees`));
    expect(list.body.attendees).toHaveLength(1);
    expect(list.body.attendees[0].client_id).toBe(A.clientId);
  });
});

// ── TR-MED-7 ────────────────────────────────────────────────────────────────
describe('TR-MED-7: progress entries require a client you own', () => {
  test('A cannot file a progress entry against B client', async () => {
    const res = await asA(request(app).post(`/api/progress/${B.clientId}`))
      .send({ metric_name: 'weight', value: 99 });

    expect(res.status).toBe(404);
    const rows = await pool.query(
      'SELECT id FROM progress_entries WHERE client_id = $1',
      [B.clientId]
    );
    expect(rows.rows).toHaveLength(0);
  });

  test('a malformed client id is refused as a client error, not a 500', async () => {
    const res = await asA(request(app).post('/api/progress/not-a-uuid'))
      .send({ metric_name: 'weight', value: 80 });
    expect(res.status).toBe(404);
  });

  test('filing a progress entry for your own client still works', async () => {
    const res = await asA(request(app).post(`/api/progress/${A.clientId}`))
      .send({ metric_name: 'weight', value: 80 });
    expect(res.status).toBe(201);
    expect(res.body.entry.tenant_id).toBe(A.tenantId);
  });
});

// ── Object property level authorization (API3) ──────────────────────────────
describe('API3: unexpected body properties cannot rewrite ownership or state', () => {
  test('POST /api/clients ignores an attacker-supplied tenant_id', async () => {
    const res = await asA(request(app).post('/api/clients')).send({
      firstName: 'Mass', lastName: 'Assignment',
      tenant_id: B.tenantId, tenantId: B.tenantId, id: ABSENT_UUID,
    });
    expect(res.status).toBe(201);

    const created = res.body.client;
    const row = await pool.query('SELECT tenant_id FROM clients WHERE id = $1', [created.id]);
    // The row must belong to the caller's tenant, from the JWT — not to the
    // tenant named in the body, and not at the id the body asked for.
    expect(row.rows[0].tenant_id).toBe(A.tenantId);
    expect(created.id).not.toBe(ABSENT_UUID);
  });

  test('PUT /api/clients/:id ignores tenant_id, id and created_at in the body', async () => {
    const before = await pool.query(
      'SELECT tenant_id, created_at FROM clients WHERE id = $1', [A.clientId]
    );

    const res = await asA(request(app).put(`/api/clients/${A.clientId}`)).send({
      firstName: 'Renamed',
      tenant_id: B.tenantId,
      id: ABSENT_UUID,
      created_at: '1999-01-01T00:00:00Z',
    });
    expect(res.status).toBe(200);

    const after = await pool.query(
      'SELECT id, tenant_id, first_name, created_at FROM clients WHERE id = $1', [A.clientId]
    );
    expect(after.rows[0].tenant_id).toBe(before.rows[0].tenant_id);
    expect(after.rows[0].created_at).toEqual(before.rows[0].created_at);
    expect(after.rows[0].first_name).toBe('Renamed'); // the legitimate half applied
  });

  test('PUT /api/profile ignores password_hash, email_verified, dpa_accepted and role-like fields', async () => {
    const before = await pool.query(
      `SELECT password_hash, email_verified, dpa_accepted, tenant_id
       FROM users WHERE id = $1`, [A.userId]
    );

    const res = await asA(request(app).put('/api/profile')).send({
      firstName: 'Legit',
      password_hash: 'attacker-controlled',
      email_verified: true,
      dpa_accepted: true,
      is_admin: true,
      role: 'admin',
      tenant_id: B.tenantId,
      failed_login_attempts: 0,
      locked_until: null,
    });
    expect(res.status).toBe(200);

    const after = await pool.query(
      `SELECT password_hash, email_verified, dpa_accepted, tenant_id, first_name
       FROM users WHERE id = $1`, [A.userId]
    );
    expect(after.rows[0].password_hash).toBe(before.rows[0].password_hash);
    expect(after.rows[0].email_verified).toBe(before.rows[0].email_verified);
    expect(after.rows[0].dpa_accepted).toBe(before.rows[0].dpa_accepted);
    expect(after.rows[0].tenant_id).toBe(before.rows[0].tenant_id);
    expect(after.rows[0].first_name).toBe('Legit');
  });

  test('PUT /api/sessions/:id ignores tenant_id in the body', async () => {
    const res = await asA(request(app).put(`/api/sessions/${sessionA.id}`)).send({
      notes: 'updated', tenant_id: B.tenantId,
    });
    expect(res.status).toBe(200);

    const row = await pool.query(
      'SELECT tenant_id FROM training_sessions WHERE id = $1', [sessionA.id]
    );
    expect(row.rows[0].tenant_id).toBe(A.tenantId);
  });

  test('POST /api/progress ignores a body-supplied tenant_id', async () => {
    const res = await asA(request(app).post(`/api/progress/${A.clientId}`)).send({
      metric_name: 'bodyfat', value: 15, tenant_id: B.tenantId,
    });
    expect(res.status).toBe(201);
    expect(res.body.entry.tenant_id).toBe(A.tenantId);
  });
});
