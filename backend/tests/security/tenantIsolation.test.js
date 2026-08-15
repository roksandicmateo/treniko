'use strict';

/**
 * Multi-tenant isolation — adversarial tests (Phase 2A).
 *
 * Two independent trainers are created. Trainer A is the attacker and always
 * presents a valid token of their own; only the resource ids are swapped for
 * Trainer B's. Everything is exercised through the real Express stack against
 * a real database, so these assert backend behaviour rather than UI visibility.
 *
 * Primary regression target: TR-CRIT-2, the group-session attendance IDOR.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool, queryAs } = require('../helpers/fixtures');

jest.setTimeout(30000);

// A syntactically valid UUID that belongs to nobody.
const ABSENT_UUID = '00000000-0000-4000-8000-000000000000';

let A;
let B;

beforeAll(async () => {
  A = await createTenant('a');
  B = await createTenant('b');
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

const asA = (req) => req.set('Authorization', `Bearer ${A.token}`);

describe('TR-CRIT-2: group-session attendance cross-tenant write', () => {
  test("Trainer A cannot flip attendance on Trainer B's group session", async () => {
    const before = await queryAs(B,
      'SELECT status FROM group_session_attendance WHERE id = $1',
      [B.attendanceId]
    );
    expect(before.rows[0].status).toBe('scheduled');

    // The attack: A's own groupId (so the group-ownership check passes)
    // combined with B's session and client ids.
    const res = await asA(
      request(app).put(
        `/api/groups/${A.groupId}/sessions/${B.groupSessionId}/attendance/${B.clientId}`
      )
    ).send({ status: 'no_show' });

    expect(res.status).toBe(404);

    // The victim's record must be byte-for-byte unchanged.
    const after = await queryAs(B,
      'SELECT status FROM group_session_attendance WHERE id = $1',
      [B.attendanceId]
    );
    expect(after.rows[0].status).toBe('scheduled');
  });

  test("Trainer A cannot use Trainer B's groupId either", async () => {
    const res = await asA(
      request(app).put(
        `/api/groups/${B.groupId}/sessions/${B.groupSessionId}/attendance/${B.clientId}`
      )
    ).send({ status: 'no_show' });

    expect(res.status).toBe(404);

    const after = await queryAs(B,
      'SELECT status FROM group_session_attendance WHERE id = $1',
      [B.attendanceId]
    );
    expect(after.rows[0].status).toBe('scheduled');
  });

  test('a non-existent id is indistinguishable from another tenant\'s id', async () => {
    const foreign = await asA(
      request(app).put(
        `/api/groups/${A.groupId}/sessions/${B.groupSessionId}/attendance/${B.clientId}`
      )
    ).send({ status: 'completed' });

    const absent = await asA(
      request(app).put(
        `/api/groups/${A.groupId}/sessions/${ABSENT_UUID}/attendance/${ABSENT_UUID}`
      )
    ).send({ status: 'completed' });

    // Same status and same body: the response cannot be used to probe for the
    // existence of another tenant's records.
    expect(foreign.status).toBe(absent.status);
    expect(foreign.body).toEqual(absent.body);
  });

  test('malformed ids are rejected without a 500 (no error-based disclosure)', async () => {
    const res = await asA(
      request(app).put(
        `/api/groups/${A.groupId}/sessions/not-a-uuid/attendance/also-not-a-uuid`
      )
    ).send({ status: 'completed' });

    expect(res.status).toBe(404);
  });

  test('the legitimate owner can still update their own attendance', async () => {
    const res = await asA(
      request(app).put(
        `/api/groups/${A.groupId}/sessions/${A.groupSessionId}/attendance/${A.clientId}`
      )
    ).send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const after = await queryAs(A,
      'SELECT status FROM group_session_attendance WHERE id = $1',
      [A.attendanceId]
    );
    expect(after.rows[0].status).toBe('completed');
  });

  test('an invalid status value is rejected', async () => {
    const res = await asA(
      request(app).put(
        `/api/groups/${A.groupId}/sessions/${A.groupSessionId}/attendance/${A.clientId}`
      )
    ).send({ status: 'definitely-not-valid' });

    expect(res.status).toBe(400);
  });
});

describe('cross-tenant access on other tenant-owned resources', () => {
  test("A cannot read B's client", async () => {
    const res = await asA(request(app).get(`/api/clients/${B.clientId}`));
    expect(res.status).toBe(404);
  });

  test("A cannot update B's client", async () => {
    const res = await asA(request(app).put(`/api/clients/${B.clientId}`))
      .send({ firstName: 'Pwned' });
    expect(res.status).toBe(404);

    const after = await queryAs(B, 'SELECT first_name FROM clients WHERE id = $1', [B.clientId]);
    expect(after.rows[0].first_name).toBe('Client');
  });

  test("A cannot delete B's client", async () => {
    const res = await asA(request(app).delete(`/api/clients/${B.clientId}`));
    expect(res.status).toBe(404);

    const still = await queryAs(B, 'SELECT id FROM clients WHERE id = $1', [B.clientId]);
    expect(still.rows).toHaveLength(1);
  });

  test("A cannot read B's group", async () => {
    const res = await asA(request(app).get(`/api/groups/${B.groupId}`));
    expect(res.status).toBe(404);
  });

  test("A cannot delete B's group", async () => {
    const res = await asA(request(app).delete(`/api/groups/${B.groupId}`));
    expect(res.status).toBe(404);

    const still = await queryAs(B, 'SELECT id FROM groups WHERE id = $1', [B.groupId]);
    expect(still.rows).toHaveLength(1);
  });

  test("A cannot read B's training", async () => {
    const res = await asA(request(app).get(`/api/trainings/${B.trainingId}`));
    expect(res.status).toBe(404);
  });

  test("A cannot delete B's training", async () => {
    const res = await asA(request(app).delete(`/api/trainings/${B.trainingId}`));
    expect(res.status).toBe(404);

    const still = await queryAs(B, 'SELECT id FROM trainings WHERE id = $1', [B.trainingId]);
    expect(still.rows).toHaveLength(1);
  });

  test("A cannot read B's group session detail", async () => {
    const res = await asA(
      request(app).get(`/api/groups/${B.groupId}/sessions/${B.groupSessionId}`)
    );
    expect(res.status).toBe(404);
  });

  test('A can still operate on their own resources (no over-blocking)', async () => {
    const client = await asA(request(app).get(`/api/clients/${A.clientId}`));
    expect(client.status).toBe(200);

    const group = await asA(request(app).get(`/api/groups/${A.groupId}`));
    expect(group.status).toBe(200);

    const training = await asA(request(app).get(`/api/trainings/${A.trainingId}`));
    expect(training.status).toBe(200);
  });
});
