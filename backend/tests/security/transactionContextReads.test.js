'use strict';

/**
 * A read issued after COMMIT must still carry a tenant context.
 *
 * ── The defect this pins ─────────────────────────────────────────────────────
 * Found while activating the restricted runtime role locally (Phase 4
 * activation), not by the suite — because it is invisible unless row-level
 * security is actually enforced.
 *
 * `POST /api/trainings` and `PUT /api/trainings/:id` check out a client, run
 * their writes in an explicit transaction, COMMIT, and then read the finished
 * record back to return it. That read-back was issued on the SAME checked-out
 * client:
 *
 *     await dbClient.query('COMMIT');
 *     const full = await loadFull(training.id, tenantId, dbClient);   // <-- here
 *
 * The tenant context is established by the wrapper in config/database.js when
 * the caller issues BEGIN, with SET LOCAL semantics — so PostgreSQL discards it
 * at that COMMIT. The read therefore ran with NO tenant context at all. Against
 * the table owner (where policies are skipped) it worked, which is why every
 * existing test passed. Under the restricted role every policy denied it,
 * `loadFull` returned null, and the endpoint answered **201 with an empty
 * body** — a success status carrying nothing, for a record that had in fact
 * been created correctly.
 *
 * The fix routes the read-back through `pool.query`, which establishes a
 * context per query.
 *
 * ── Why these assertions run in BOTH modes ───────────────────────────────────
 * "The response body contains the created record" is true regardless of whether
 * policies are enforced, so this suite is not restricted-only. It passes today
 * in both modes and fails in the restricted run if the pattern comes back —
 * which is the run that would catch it.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool } = require('../helpers/fixtures');

let A;

beforeAll(async () => {
  A = await createTenant('txread-a');
}, 30000);

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await pool.end();
});

const asA = (req) => req.set('Authorization', `Bearer ${A.token}`);

const newTraining = () => ({
  clientId: A.clientId,
  title: 'post-commit read-back',
  startTime: new Date(Date.now() + 86400000).toISOString(),
  endTime: new Date(Date.now() + 90000000).toISOString(),
});

describe('POST /api/trainings returns the record it just created', () => {
  test('a 201 carries a body, not an empty response', async () => {
    const res = await asA(request(app).post('/api/trainings')).send(newTraining());

    expect(res.status).toBe(201);
    // The exact symptom of the defect: a success status with nothing in it.
    expect(res.body).toBeTruthy();
    expect(res.body).not.toEqual({});
    expect(res.body.id).toEqual(expect.any(String));
  });

  test('the read-back resolved the joined client, so it really re-read the row', async () => {
    // loadFull JOINs `clients`. If the read-back had no tenant context, the
    // join would match nothing even if the training row itself were visible —
    // so this is what distinguishes a genuine read from a lucky echo of the
    // request body.
    const res = await asA(request(app).post('/api/trainings')).send(newTraining());

    expect(res.status).toBe(201);
    expect(res.body.first_name).toBeTruthy();
    expect(res.body.tenant_id).toBe(A.tenantId);
    expect(Array.isArray(res.body.exercises)).toBe(true);
  });

  test('the created training is subsequently readable by its owner', async () => {
    const created = await asA(request(app).post('/api/trainings')).send(newTraining());
    expect(created.status).toBe(201);

    const read = await asA(request(app).get(`/api/trainings/${created.body.id}`));
    expect(read.status).toBe(200);
    expect(read.body.id).toBe(created.body.id);
  });
});

describe('PUT /api/trainings/:id returns the record it just updated', () => {
  test('a 200 carries the updated body, not an empty response', async () => {
    const created = await asA(request(app).post('/api/trainings')).send(newTraining());
    expect(created.status).toBe(201);

    const updated = await asA(request(app).put(`/api/trainings/${created.body.id}`))
      .send({ ...newTraining(), title: 'renamed after commit' });

    expect(updated.status).toBe(200);
    expect(updated.body).toBeTruthy();
    expect(updated.body).not.toEqual({});
    expect(updated.body.id).toBe(created.body.id);
    expect(updated.body.title).toBe('renamed after commit');
  });
});
