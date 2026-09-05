'use strict';

/**
 * Session reminders — the first message this product ever sends to a client.
 *
 * The value of a reminder is entirely in it being correct: one sent twice is
 * worse than none, one sent for a cancelled session is embarrassing, and one
 * sent for the old time after a reschedule actively causes the no-show it was
 * supposed to prevent. Each of those is pinned below.
 *
 * Delivery itself is not exercised — `BREVO_API_KEY` is unset in tests, so
 * emailService reports a skip — but everything that decides WHETHER to send,
 * and the record that prevents a second send, runs for real against the
 * database.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool, queryAs } = require('../helpers/fixtures');
const { findDueReminders, sendDueReminders } = require('../../jobs/sessionReminders');

jest.setTimeout(30000);

let T;
const auth = (req) => req.set('Authorization', `Bearer ${T.token}`);

/**
 * A session whose start is `hoursAhead` from now in the trainer's own zone.
 * Computed in the database so the test uses the same clock the job does.
 */
const sessionAt = async (clientId, hoursAhead) => {
  // Start and end both come from the database, so the end never rolls past
  // midnight into an invalid "25:10" and the times use the same clock the job
  // reads.
  const { rows } = await pool.query(
    `SELECT ((NOW() + ($1 || ' hours')::interval) AT TIME ZONE 'Europe/Zagreb')::date::text AS d,
            to_char((NOW() + ($1 || ' hours')::interval) AT TIME ZONE 'Europe/Zagreb', 'HH24:MI') AS t,
            to_char(LEAST(
              (NOW() + ($1 || ' hours')::interval) AT TIME ZONE 'Europe/Zagreb' + INTERVAL '1 hour',
              date_trunc('day', (NOW() + ($1 || ' hours')::interval) AT TIME ZONE 'Europe/Zagreb')
                + INTERVAL '23 hours 59 minutes'
            ), 'HH24:MI') AS e`,
    [hoursAhead]
  );
  const { d, t, e: end } = rows[0];
  const res = await auth(request(app).post('/api/sessions')).send({
    clientId, sessionDate: d, startTime: t, endTime: end, force: true,
  });
  expect(res.status).toBe(201);
  return { id: res.body.session.id, date: d, time: t };
};

const clientWithEmail = async (firstName) => {
  const res = await auth(request(app).post('/api/clients')).send({
    firstName, lastName: 'Reminder', email: `${firstName.toLowerCase()}.rem@example.test`,
  });
  return res.body.client.id;
};

const dueFor = async (sessionId) =>
  (await findDueReminders()).filter((r) => r.session_id === sessionId);

const remindersFor = async (sessionId) => {
  const { rows } = await queryAs(T,
    'SELECT * FROM session_reminders WHERE session_id = $1', [sessionId]);
  return rows;
};

beforeAll(async () => { T = await createTenant('rem'); });
afterAll(async () => { await destroyTenant(T?.tenantId); await pool.end(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('what is due', () => {
  test('a session about 24 hours away is due', async () => {
    const clientId = await clientWithEmail('Duesoon');
    const session = await sessionAt(clientId, 24);
    expect(await dueFor(session.id)).toHaveLength(1);
  });

  test('a session next week is not due yet', async () => {
    const clientId = await clientWithEmail('Faroff');
    const session = await sessionAt(clientId, 24 * 7);
    expect(await dueFor(session.id)).toHaveLength(0);
  });

  test('a session in two hours is past reminding', async () => {
    const clientId = await clientWithEmail('Toosoon');
    const session = await sessionAt(clientId, 2);
    expect(await dueFor(session.id)).toHaveLength(0);
  });

  test('a cancelled session is never reminded', async () => {
    const clientId = await clientWithEmail('Cancelled');
    const session = await sessionAt(clientId, 24);
    await auth(request(app).put(`/api/sessions/${session.id}`)).send({ status: 'cancelled' });
    expect(await dueFor(session.id)).toHaveLength(0);
  });

  test('a completed session is never reminded', async () => {
    const clientId = await clientWithEmail('Alreadydone');
    const session = await sessionAt(clientId, 24);
    await auth(request(app).put(`/api/sessions/${session.id}`)).send({ status: 'completed' });
    expect(await dueFor(session.id)).toHaveLength(0);
  });

  test('a client with no email address is skipped', async () => {
    const res = await auth(request(app).post('/api/clients'))
      .send({ firstName: 'Noemail', lastName: 'Reminder' });
    const session = await sessionAt(res.body.client.id, 24);
    expect(await dueFor(session.id)).toHaveLength(0);
  });

  test('a client who opted out is skipped', async () => {
    const clientId = await clientWithEmail('Optout');
    await queryAs(T, 'UPDATE clients SET reminders_opt_out = true WHERE id = $1', [clientId]);
    const session = await sessionAt(clientId, 24);
    expect(await dueFor(session.id)).toHaveLength(0);
  });

  test('a trainer who turned reminders off sends none at all', async () => {
    const clientId = await clientWithEmail('Trainerof');
    const session = await sessionAt(clientId, 24);
    expect(await dueFor(session.id)).toHaveLength(1);

    await pool.query('UPDATE users SET session_reminders_enabled = false WHERE tenant_id = $1', [T.tenantId]);
    expect(await dueFor(session.id)).toHaveLength(0);

    await pool.query('UPDATE users SET session_reminders_enabled = true WHERE tenant_id = $1', [T.tenantId]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sending is idempotent', () => {
  let clientId;
  let session;

  beforeAll(async () => {
    clientId = await clientWithEmail('Once');
    session = await sessionAt(clientId, 24);
  });

  test('the first run records the reminder', async () => {
    await sendDueReminders();
    const rows = await remindersFor(session.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('sent');
  });

  test('a second run sends nothing more', async () => {
    await sendDueReminders();
    await sendDueReminders();
    expect(await remindersFor(session.id)).toHaveLength(1);
  });

  test('and the session is no longer due', async () => {
    expect(await dueFor(session.id)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('rescheduling', () => {
  test('moving a session makes it due again, so the client gets the new time', async () => {
    const clientId = await clientWithEmail('Moved');
    const session = await sessionAt(clientId, 24);

    await sendDueReminders();
    expect(await remindersFor(session.id)).toHaveLength(1);

    // Pushed a day out and back into the window, the way a client asking to
    // move to the same time tomorrow would land.
    const { rows } = await pool.query(
      `SELECT ((NOW() + INTERVAL '24 hours') AT TIME ZONE 'Europe/Zagreb')::date::text AS d`
    );
    await auth(request(app).put(`/api/sessions/${session.id}`))
      .send({ sessionDate: rows[0].d, startTime: '05:30', endTime: '06:30', force: true });

    // The old record is cleared, so the job can tell them the new time.
    expect(await remindersFor(session.id)).toHaveLength(0);
  });

  test('editing only the note does not resend', async () => {
    const clientId = await clientWithEmail('Noted');
    const session = await sessionAt(clientId, 24);
    await sendDueReminders();
    expect(await remindersFor(session.id)).toHaveLength(1);

    await auth(request(app).put(`/api/sessions/${session.id}`))
      .send({ notes: 'Bring the resistance bands' });

    expect(await remindersFor(session.id)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tenant isolation', () => {
  test('the job never reads another tenant into this one\'s reminders', async () => {
    const other = await createTenant('rem-other');
    try {
      await pool.query(
        `UPDATE clients SET email = 'other.rem@example.test' WHERE id = $1`,
        [other.clientId]
      );
      const res = await request(app).post('/api/sessions')
        .set('Authorization', `Bearer ${other.token}`)
        .send({
          clientId: other.clientId,
          sessionDate: (await pool.query(
            `SELECT ((NOW() + INTERVAL '24 hours') AT TIME ZONE 'Europe/Zagreb')::date::text AS d`
          )).rows[0].d,
          startTime: '04:15', endTime: '05:15', force: true,
        });
      expect(res.status).toBe(201);

      await sendDueReminders();

      // Each reminder row carries the tenant of the session that caused it.
      const { rows } = await pool.query(
        `SELECT sr.tenant_id, ts.tenant_id AS session_tenant
           FROM session_reminders sr
           JOIN training_sessions ts ON ts.id = sr.session_id`
      );
      for (const row of rows) {
        expect(row.tenant_id).toBe(row.session_tenant);
      }
    } finally {
      await destroyTenant(other.tenantId);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the trainer\'s time zone decides when a session is', () => {
  test('a session is due 24 hours before it starts in the trainer\'s zone, not the server\'s', async () => {
    // Moving the trainer's zone moves the wall clock, so a session that was
    // 24 hours away is no longer exactly 24 hours away. Both zones are checked
    // against the job's own window rather than against a hardcoded hour, so
    // this passes wherever the test host happens to be.
    const clientId = await clientWithEmail('Zoned');

    await pool.query("UPDATE users SET timezone = 'Pacific/Auckland' WHERE tenant_id = $1", [T.tenantId]);
    const { rows } = await pool.query(
      `SELECT ((NOW() + INTERVAL '24 hours') AT TIME ZONE 'Pacific/Auckland')::date::text AS d,
              to_char((NOW() + INTERVAL '24 hours') AT TIME ZONE 'Pacific/Auckland', 'HH24:MI') AS t`
    );
    const created = await auth(request(app).post('/api/sessions')).send({
      clientId, sessionDate: rows[0].d, startTime: rows[0].t, endTime: '23:59', force: true,
    });
    expect(created.status).toBe(201);
    expect(await dueFor(created.body.session.id)).toHaveLength(1);

    // The same wall-clock session read in a zone twelve hours away is not due.
    await pool.query("UPDATE users SET timezone = 'Europe/Zagreb' WHERE tenant_id = $1", [T.tenantId]);
    expect(await dueFor(created.body.session.id)).toHaveLength(0);
  });
});
