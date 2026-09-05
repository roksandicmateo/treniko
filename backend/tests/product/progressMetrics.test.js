'use strict';

/**
 * Progress metrics and client history — product regression suite.
 *
 * Three defects found while capturing product screenshots for the September
 * 2026 marketing sprint, all of them visible to a trainer on a normal screen:
 *
 *   total hours        — the stats query joined trainings to sets and then summed
 *                        the *training's* duration, so each session's length was
 *                        added once per set. Eight one-hour sessions of three
 *                        exercises × three sets reported 72.0 h.
 *
 *   strength payload   — GET /progress/:id/strength returned a bare array per
 *                        exercise. The client reads `exercise.entries`, which on
 *                        an array resolves to `Array.prototype.entries` — a
 *                        function — so the Progress → Strength tab died with
 *                        "TypeError: entries.map is not a function".
 *
 *   last session       — `clients.last_session_date` and
 *                        `client_statistics.last_session_date` both took the most
 *                        recent session on record regardless of status or date, so
 *                        a booking for next week was shown to the trainer as the
 *                        client's *last* session, and a client who had gone quiet
 *                        looked active on the dashboard's attention panel.
 *
 * Written against the real Express stack and a real PostgreSQL database with
 * row-level security in force: two of the three live in SQL, and a mock would
 * assert nothing.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool, asTenant } = require('../helpers/fixtures');

jest.setTimeout(60000);

let T;
const auth = (req) => req.set('Authorization', `Bearer ${T.token}`);

/** yyyy-mm-dd, `offset` days from today, in the server's own timezone. */
const dayOffset = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
};

/**
 * A completed training of exactly one hour, `daysAgo` days back, with
 * `exercises` exercises of `setsPerExercise` sets each.
 *
 * @returns {Promise<string>} the training id
 */
const logTraining = async ({ daysAgo, exercises = 3, setsPerExercise = 3, weight = 60 }) =>
  asTenant({ tenantId: T.tenantId, userId: T.userId }, async () => {
    const start = `${dayOffset(-daysAgo)} 07:00:00`;
    const end = `${dayOffset(-daysAgo)} 08:00:00`;
    const { rows: [training] } = await pool.query(
      `INSERT INTO trainings (tenant_id, client_id, title, start_time, end_time, is_completed)
       VALUES ($1, $2, 'regression training', $3::timestamp, $4::timestamp, true)
       RETURNING id`,
      [T.tenantId, T.clientId, start, end]
    );

    for (let e = 0; e < exercises; e++) {
      const { rows: [te] } = await pool.query(
        `INSERT INTO training_exercises (training_id, exercise_name, sort_order)
         VALUES ($1, $2, $3) RETURNING id`,
        [training.id, `Regression Lift ${e + 1}`, e]
      );
      for (let s = 0; s < setsPerExercise; s++) {
        await pool.query(
          `INSERT INTO training_sets
             (training_exercise_id, set_number, sort_order, reps, weight, set_type)
           VALUES ($1, $2, $3, 8, $4, 'working')`,
          [te.id, s + 1, s, weight + e * 5]
        );
      }
    }
    return training.id;
  });

/** A training session row in a given state. */
const bookSession = ({ date, status }) =>
  asTenant({ tenantId: T.tenantId, userId: T.userId }, async () => {
    const { rows: [session] } = await pool.query(
      `INSERT INTO training_sessions
         (tenant_id, client_id, session_date, start_time, end_time, session_type, status, is_completed)
       VALUES ($1, $2, $3, '07:00', '08:00', 'personal', $4, $5)
       RETURNING id`,
      [T.tenantId, T.clientId, date, status, status === 'completed']
    );
    return session.id;
  });

/**
 * The one definition of "when did this client last train".
 *
 * There used to be two — this view and a denormalised `clients` column kept in
 * step by a trigger. Migration 043 dropped the column; the view is what both
 * the clients list and the dashboard now read.
 */
const readLastSession = () =>
  asTenant({ tenantId: T.tenantId, userId: T.userId }, async () => {
    const { rows: [row] } = await pool.query(
      `SELECT cs.last_session_date::text AS view_value
         FROM clients c
         JOIN client_statistics cs ON cs.client_id = c.id
        WHERE c.id = $1`,
      [T.clientId]
    );
    return row;
  });

/** The denormalised column is gone, and must stay gone. */
const columnExists = async () => {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clients'
        AND column_name = 'last_session_date'`
  );
  return rows.length > 0;
};

const clearSessions = () =>
  asTenant({ tenantId: T.tenantId, userId: T.userId }, () =>
    pool.query('DELETE FROM training_sessions WHERE client_id = $1', [T.clientId]));

beforeAll(async () => {
  T = await createTenant('progress');
  // The fixture seeds one training of its own; these tests count sessions, so
  // the arithmetic has to start from a client with none.
  await asTenant({ tenantId: T.tenantId, userId: T.userId }, () =>
    pool.query('DELETE FROM trainings WHERE client_id = $1', [T.clientId]));
});

afterAll(async () => {
  await destroyTenant(T?.tenantId);
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('total hours counts each session once, not once per set', () => {
  beforeAll(async () => {
    // Eight sessions, one hour each, three exercises of three sets: 72 set rows.
    for (let i = 1; i <= 8; i++) await logTraining({ daysAgo: i, exercises: 3, setsPerExercise: 3 });
  });

  test('eight one-hour sessions total 8 hours, not 72 (was: 72.0)', async () => {
    const res = await auth(request(app).get(`/api/progress/client/${T.clientId}?months=6`));

    expect(res.status).toBe(200);
    expect(Number(res.body.stats.total_hours)).toBeCloseTo(8, 1);
  });

  test('the set and session counts are unchanged by the fix', async () => {
    const res = await auth(request(app).get(`/api/progress/client/${T.clientId}?months=6`));

    expect(res.body.stats.total_sessions).toBe(8);
    expect(res.body.stats.total_sets).toBe(72);
    expect(res.body.stats.unique_exercises).toBeGreaterThanOrEqual(0);
  });

  test('a completed session with no sets logged still counts as a session and an hour', async () => {
    const before = await auth(request(app).get(`/api/progress/client/${T.clientId}?months=6`));
    const hoursBefore = Number(before.body.stats.total_hours);
    const sessionsBefore = before.body.stats.total_sessions;
    const setsBefore = before.body.stats.total_sets;

    // A session the trainer ran and marked complete, but never wrote sets for.
    await logTraining({ daysAgo: 10, exercises: 0, setsPerExercise: 0 });

    const after = await auth(request(app).get(`/api/progress/client/${T.clientId}?months=6`));
    expect(after.body.stats.total_sessions).toBe(sessionsBefore + 1);
    expect(Number(after.body.stats.total_hours)).toBeCloseTo(hoursBefore + 1, 1);
    // …and contributes nothing to the tiles that count logged work.
    expect(after.body.stats.total_sets).toBe(setsBefore);
  });

  test('one session with many sets still contributes exactly its own hour', async () => {
    const before = await auth(request(app).get(`/api/progress/client/${T.clientId}?months=6`));
    const hoursBefore = Number(before.body.stats.total_hours);

    // 5 exercises × 8 sets = 40 set rows on a single one-hour session. Under the
    // old query this alone added 40 hours.
    await logTraining({ daysAgo: 9, exercises: 5, setsPerExercise: 8 });

    const after = await auth(request(app).get(`/api/progress/client/${T.clientId}?months=6`));
    expect(Number(after.body.stats.total_hours)).toBeCloseTo(hoursBefore + 1, 1);
    expect(after.body.stats.total_sessions).toBe(10);   // 8 + the unlogged one + this
    expect(after.body.stats.total_sets).toBe(72 + 40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('strength payload matches the contract its consumers read', () => {
  let payload;

  beforeAll(async () => {
    const res = await auth(request(app).get(`/api/progress/${T.clientId}/strength`));
    expect(res.status).toBe(200);
    payload = res.body;
  });

  test('an exercise is an object with an own entries array (was: a bare array)', () => {
    const names = Object.keys(payload);
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      const exercise = payload[name];
      // The exact shape that caused the crash: an array, whose `.entries` is
      // Array.prototype.entries — a function, and truthy.
      expect(Array.isArray(exercise)).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(exercise, 'entries')).toBe(true);
      expect(Array.isArray(exercise.entries)).toBe(true);
      expect(typeof exercise.entries.map).toBe('function');
    }
  });

  test('the component would not throw on this payload', () => {
    // Exactly what StrengthProgress does on the first render.
    const first = payload[Object.keys(payload)[0]];
    const entries = first.entries;
    expect(() => entries.map((e) => e.maxWeight)).not.toThrow();
    expect(() => entries.reduce((best, e) => (e.maxWeight > (best?.maxWeight ?? 0) ? e : best), null))
      .not.toThrow();
  });

  test('each entry carries the fields the charts and the PR table read', () => {
    const entry = payload[Object.keys(payload)[0]].entries[0];

    expect(entry).toEqual(expect.objectContaining({
      date:        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      maxWeight:   expect.any(Number),
      estOneRM:    expect.any(Number),
      totalVolume: expect.any(Number),
      setCount:    expect.any(Number),
    }));
    // Volume is Σ reps × weight over the day's sets: 3 sets × 8 reps × weight.
    expect(entry.totalVolume).toBeCloseTo(entry.setCount * 8 * entry.maxWeight, 1);
    // Epley on an 8-rep set: weight × (1 + 8/30).
    expect(entry.estOneRM).toBeCloseTo(entry.maxWeight * (1 + 8 / 30), 1);
  });

  test('entries are chronological, because the client reads the last one as "latest"', () => {
    for (const name of Object.keys(payload)) {
      const dates = payload[name].entries.map((e) => e.date);
      expect([...dates].sort()).toEqual(dates);
    }
  });

  test('a client with no logged sets gets an empty object, not an error', async () => {
    const other = await createTenant('progress-empty');
    try {
      const res = await request(app)
        .get(`/api/progress/${other.clientId}/strength`)
        .set('Authorization', `Bearer ${other.token}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toHaveLength(0);
    } finally {
      await destroyTenant(other.tenantId);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('"last session" is the most recent session that actually happened', () => {
  beforeEach(clearSessions);

  test('a future booking is never the last session (was: it was)', async () => {
    await bookSession({ date: dayOffset(-3), status: 'completed' });
    await bookSession({ date: dayOffset(+7), status: 'scheduled' });

    const { view_value } = await readLastSession();

    expect(view_value).toBe(dayOffset(-3));
  });

  test('a cancelled session does not count', async () => {
    await bookSession({ date: dayOffset(-10), status: 'completed' });
    await bookSession({ date: dayOffset(-2), status: 'cancelled' });

    const { view_value } = await readLastSession();

    expect(view_value).toBe(dayOffset(-10));
  });

  test('a no-show does not count as a session the client attended', async () => {
    // migration 031 keeps no_show in total_sessions — the slot was spent — but a
    // client who did not turn up has not trained, and counting it here would
    // suppress the dashboard's dormant-client alert for exactly that client.
    await bookSession({ date: dayOffset(-14), status: 'completed' });
    await bookSession({ date: dayOffset(-1), status: 'no_show' });

    const { view_value } = await readLastSession();

    expect(view_value).toBe(dayOffset(-14));
  });

  test('a session completed today counts', async () => {
    await bookSession({ date: dayOffset(0), status: 'completed' });

    const { view_value } = await readLastSession();

    expect(view_value).toBe(dayOffset(0));
  });

  test('a session marked completed but dated in the future does not', async () => {
    await bookSession({ date: dayOffset(-5), status: 'completed' });
    await bookSession({ date: dayOffset(+2), status: 'completed' });

    const { view_value } = await readLastSession();

    expect(view_value).toBe(dayOffset(-5));
  });

  test('a client with only future bookings has no last session at all', async () => {
    await bookSession({ date: dayOffset(+3), status: 'scheduled' });

    const { view_value } = await readLastSession();

    expect(view_value).toBeNull();
  });

  test('completing a scheduled session changes the answer immediately', async () => {
    // This used to be maintained by a trigger that fired only on INSERT or
    // UPDATE OF session_date, so the one event that changes the answer — the
    // status change — never refreshed it. Reading the view removes the class of
    // problem: there is nothing to refresh.
    const sessionId = await bookSession({ date: dayOffset(-4), status: 'scheduled' });
    expect((await readLastSession()).view_value).toBeNull();

    await asTenant({ tenantId: T.tenantId, userId: T.userId }, () =>
      pool.query(
        `UPDATE training_sessions SET status = 'completed', is_completed = true WHERE id = $1`,
        [sessionId]
      ));

    expect((await readLastSession()).view_value).toBe(dayOffset(-4));
  });

  test('deleting the last session rolls the date back to the one before it', async () => {
    // Also unmaintainable by the old trigger, which never fired on DELETE.
    await bookSession({ date: dayOffset(-20), status: 'completed' });
    const newer = await bookSession({ date: dayOffset(-6), status: 'completed' });
    expect((await readLastSession()).view_value).toBe(dayOffset(-6));

    await asTenant({ tenantId: T.tenantId, userId: T.userId }, () =>
      pool.query('DELETE FROM training_sessions WHERE id = $1', [newer]));

    expect((await readLastSession()).view_value).toBe(dayOffset(-20));
  });

  test('the denormalised clients.last_session_date column is gone (migration 043)', async () => {
    // Two definitions of one fact is how they drifted apart in the first place.
    expect(await columnExists()).toBe(false);
  });

  test('the clients list serves the corrected value', async () => {
    await bookSession({ date: dayOffset(-8), status: 'completed' });
    await bookSession({ date: dayOffset(+5), status: 'scheduled' });

    const res = await auth(request(app).get('/api/clients'));
    expect(res.status).toBe(200);

    const client = res.body.clients.find((c) => c.id === T.clientId);
    // Only `last_session_date` is asserted here: it is the field under repair,
    // and it is what the list has always sent. The date is compared as a plain
    // calendar date — a DATE that serialises as a timestamp arrives as the
    // previous day for anyone west of the server.
    expect(String(client.last_session_date).slice(0, 10)).toBe(dayOffset(-8));
    expect(String(client.last_session_date)).not.toContain(dayOffset(+5));
  });
});
