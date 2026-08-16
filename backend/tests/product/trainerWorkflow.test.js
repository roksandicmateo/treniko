'use strict';

/**
 * Trainer workflow — product regression suite.
 *
 * Every test here corresponds to a defect found by walking the real product as
 * a personal trainer would use it, and fixed in the same sprint. They are
 * written against the running Express stack and a real PostgreSQL database with
 * row-level security in force, because several of the defects existed *only*
 * under those conditions and would pass against a mock.
 *
 * What each group protects:
 *
 *   scheduling a group session   — the handler used a raw pool.connect(), which
 *                                  carries no tenant context, so RLS denied
 *                                  every statement and the endpoint answered
 *                                  404 "Group not found" for a group that
 *                                  existed. Group sessions could not be created
 *                                  at all.
 *   calendar dates               — DATE columns returned as timestamps, which
 *                                  serialise as the previous day east of
 *                                  Greenwich and broke date parsing in the UI.
 *   package consumption          — completing a session never decremented the
 *                                  client's package, so "sessions remaining"
 *                                  never moved.
 *   client statistics            — counts were derived from the session date
 *                                  alone, ignoring status, so completed
 *                                  sessions read as upcoming and cancelled ones
 *                                  were counted as completed.
 *   client creation              — fields past `phone` were accepted and
 *                                  silently dropped.
 *   data export                  — gated behind a paid plan, so no trainer on
 *                                  the Free plan could exercise data
 *                                  portability.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool, queryAs } = require('../helpers/fixtures');

jest.setTimeout(30000);

let T;

const auth = (req) => req.set('Authorization', `Bearer ${T.token}`);

/** yyyy-mm-dd for `offset` days from today, in the server's own timezone. */
const dayOffset = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
};

/** A plain calendar date, e.g. "2026-08-20" — never a timestamp. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

beforeAll(async () => {
  T = await createTenant('product');
});

afterAll(async () => {
  await destroyTenant(T?.tenantId);
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('group sessions are usable at all', () => {
  let groupSessionId;

  test('a group session can be scheduled (was: 404 "Group not found" under RLS)', async () => {
    const res = await auth(request(app).post(`/api/groups/${T.groupId}/sessions`)).send({
      sessionDate: dayOffset(2),
      startTime: '18:00',
      endTime: '19:00',
      sessionType: 'HIIT',
      notes: 'Bootcamp',
    });

    expect(res.status).toBe(201);
    expect(res.body.groupSession).toBeTruthy();
    expect(res.body.memberCount).toBeGreaterThan(0);
    groupSessionId = res.body.groupSession.id;
  });

  test('the created session is actually in the database', async () => {
    const { rows } = await queryAs(T, 'SELECT id FROM group_sessions WHERE id = $1', [groupSessionId]);
    expect(rows).toHaveLength(1);
  });

  test('its log and per-member attendance can be saved (same tenant-context defect)', async () => {
    const res = await auth(
      request(app).put(`/api/groups/${T.groupId}/sessions/${groupSessionId}`)
    ).send({
      workoutType: 'HIIT',
      notes: 'Great energy',
      status: 'completed',
      attendance: [{ clientId: T.clientId, status: 'completed' }],
    });

    expect(res.status).toBe(200);

    const { rows } = await queryAs(T,
      'SELECT status FROM group_session_attendance WHERE group_session_id = $1 AND client_id = $2',
      [groupSessionId, T.clientId]
    );
    expect(rows[0].status).toBe('completed');
  });

  test('group session dates come back as calendar dates, not timestamps', async () => {
    const created = dayOffset(2);

    const list = await auth(request(app).get(`/api/groups/${T.groupId}/sessions`));
    expect(list.status).toBe(200);
    const listed = list.body.sessions.find(s => s.id === groupSessionId);
    expect(listed.session_date).toMatch(CALENDAR_DATE);
    expect(listed.session_date).toBe(created);

    const calendar = await auth(
      request(app).get(`/api/groups/sessions/calendar?startDate=${dayOffset(-7)}&endDate=${dayOffset(30)}`)
    );
    expect(calendar.status).toBe(200);
    const onCalendar = calendar.body.sessions.find(s => s.id === groupSessionId);
    expect(onCalendar.session_date).toBe(created);

    const detail = await auth(
      request(app).get(`/api/groups/${T.groupId}/sessions/${groupSessionId}`)
    );
    expect(detail.status).toBe(200);
    expect(detail.body.session.session_date).toBe(created);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('session dates survive the round trip', () => {
  let sessionId;
  const date = dayOffset(1);

  test('create returns the date it was given', async () => {
    const res = await auth(request(app).post('/api/sessions')).send({
      clientId: T.clientId, sessionDate: date, startTime: '09:00', endTime: '10:00',
    });
    expect(res.status).toBe(201);
    expect(res.body.session.session_date).toBe(date);
    sessionId = res.body.session.id;
  });

  test('update returns the date it was given', async () => {
    const moved = dayOffset(3);
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({
      sessionDate: moved, startTime: '09:00', endTime: '10:00', force: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.session.session_date).toBe(moved);
  });

  test('the dashboard reports calendar dates and session status', async () => {
    // Put it back inside the dashboard's 7-day window.
    await auth(request(app).put(`/api/sessions/${sessionId}`))
      .send({ sessionDate: dayOffset(1), startTime: '09:00', endTime: '10:00', force: true });

    const res = await auth(request(app).get('/api/dashboard'));
    expect(res.status).toBe(200);

    const upcoming = res.body.dashboard.upcomingSessions.find(s => s.id === sessionId);
    expect(upcoming).toBeTruthy();
    expect(upcoming.session_date).toMatch(CALENDAR_DATE);
    // `status` was never selected, so every row looked "scheduled" to the UI
    // and the session modal opened with the wrong state.
    expect(upcoming.status).toBe('scheduled');
  });

  test('a cancelled session disappears from the dashboard', async () => {
    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'cancelled' });

    const res = await auth(request(app).get('/api/dashboard'));
    const stillListed = res.body.dashboard.upcomingSessions.some(s => s.id === sessionId);
    expect(stillListed).toBe(false);
  });

  test('the client detail endpoint reports calendar dates too', async () => {
    await auth(request(app).put(`/api/sessions/${sessionId}`))
      .send({ status: 'scheduled', sessionDate: dayOffset(1), startTime: '09:00', endTime: '10:00', force: true });

    const res = await auth(request(app).get(`/api/clients/${T.clientId}`));
    expect(res.status).toBe(200);
    const upcoming = res.body.client.upcoming_sessions.find(s => s.id === sessionId);
    expect(upcoming.session_date).toMatch(CALENDAR_DATE);
  });

  afterAll(async () => {
    if (sessionId) await auth(request(app).delete(`/api/sessions/${sessionId}`));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('completing a session consumes a package session', () => {
  let packageId;
  let clientPackageId;
  let sessionId;

  const remaining = async () => {
    const res = await auth(request(app).get(`/api/clients/${T.clientId}/packages/active`));
    const pkg = res.body.package;
    return pkg ? pkg.total_sessions - pkg.sessions_used : null;
  };

  beforeAll(async () => {
    const pkg = await auth(request(app).post('/api/packages')).send({
      name: 'Regression 10-pack', packageType: 'session_based', totalSessions: 10, price: 400,
    });
    packageId = pkg.body.package.id;

    const assigned = await auth(request(app).post(`/api/clients/${T.clientId}/packages`))
      .send({ packageId });
    clientPackageId = assigned.body.package.id;

    const session = await auth(request(app).post('/api/sessions')).send({
      clientId: T.clientId, sessionDate: dayOffset(4), startTime: '07:00', endTime: '08:00', force: true,
    });
    sessionId = session.body.session.id;
  });

  test('starts at the full balance', async () => {
    expect(await remaining()).toBe(10);
  });

  test('marking the session complete spends exactly one session', async () => {
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(await remaining()).toBe(9);
  });

  test('completing an already-complete session does not spend a second one', async () => {
    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ isCompleted: true });
    expect(await remaining()).toBe(9);
  });

  test('the usage row is linked to the session that paid for it', async () => {
    const { rows } = await queryAs(T,
      'SELECT client_package_id FROM package_session_usage WHERE session_id = $1',
      [sessionId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].client_package_id).toBe(clientPackageId);
  });

  test('undoing the completion gives the session back', async () => {
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'scheduled' });
    expect(res.status).toBe(200);
    expect(await remaining()).toBe(10);
  });

  test('deleting a completed session gives the session back', async () => {
    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    expect(await remaining()).toBe(9);

    await auth(request(app).delete(`/api/sessions/${sessionId}`));
    expect(await remaining()).toBe(10);
    sessionId = null;
  });

  test('a package with no sessions left is closed out rather than going negative', async () => {
    const small = await auth(request(app).post('/api/packages')).send({
      name: 'Regression single', packageType: 'session_based', totalSessions: 1, price: 40,
    });
    // Cancel the 10-pack so the single-session package is the active one.
    await auth(request(app).put(`/api/clients/${T.clientId}/packages/${clientPackageId}`))
      .send({ status: 'cancelled' });

    const assigned = await auth(request(app).post(`/api/clients/${T.clientId}/packages`))
      .send({ packageId: small.body.package.id });

    const session = await auth(request(app).post('/api/sessions')).send({
      clientId: T.clientId, sessionDate: dayOffset(5), startTime: '07:00', endTime: '08:00', force: true,
    });
    await auth(request(app).put(`/api/sessions/${session.body.session.id}`)).send({ status: 'completed' });

    const { rows } = await queryAs(T,
      'SELECT status, sessions_used, total_sessions FROM client_packages WHERE id = $1',
      [assigned.body.package.id]
    );
    expect(rows[0].sessions_used).toBe(1);
    expect(rows[0].status).toBe('completed');

    await auth(request(app).delete(`/api/sessions/${session.body.session.id}`));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('client statistics agree with session status', () => {
  let completed;
  let cancelled;
  let scheduled;

  beforeAll(async () => {
    const make = async (date, status) => {
      const res = await auth(request(app).post('/api/sessions')).send({
        clientId: T.clientId, sessionDate: date, startTime: '06:00', endTime: '06:45', force: true,
      });
      if (status) {
        await auth(request(app).put(`/api/sessions/${res.body.session.id}`)).send({ status });
      }
      return res.body.session.id;
    };
    // Deliberately dated in the future: the old view classified anything dated
    // today or later as "upcoming" and anything earlier as "completed", so a
    // completed session in the future was counted in the wrong column.
    completed = await make(dayOffset(6), 'completed');
    cancelled = await make(dayOffset(7), 'cancelled');
    scheduled = await make(dayOffset(8), null);
  });

  afterAll(async () => {
    for (const id of [completed, cancelled, scheduled]) {
      if (id) await auth(request(app).delete(`/api/sessions/${id}`));
    }
  });

  test('a future completed session counts as completed, not upcoming', async () => {
    const res = await auth(request(app).get('/api/clients'));
    const client = res.body.clients.find(c => c.id === T.clientId);

    expect(Number(client.completed_sessions)).toBe(1);
    expect(Number(client.upcoming_sessions)).toBe(1);   // only the scheduled one
  });

  test('a cancelled session is counted nowhere', async () => {
    const res = await auth(request(app).get('/api/clients'));
    const client = res.body.clients.find(c => c.id === T.clientId);

    // completed + scheduled, and not the cancelled one.
    expect(Number(client.total_sessions)).toBe(2);
  });

  test('next_session_date skips cancelled sessions', async () => {
    const { rows } = await queryAs(T,
      'SELECT next_session_date::text FROM client_statistics WHERE client_id = $1',
      [T.clientId]
    );
    expect(rows[0].next_session_date).toBe(dayOffset(8));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('creating a client keeps everything it was given', () => {
  let createdId;

  afterAll(async () => {
    if (createdId) await auth(request(app).delete(`/api/clients/${createdId}`));
  });

  test('goals, injuries, diet, notes and date of birth are persisted, not dropped', async () => {
    const res = await auth(request(app).post('/api/clients')).send({
      firstName: 'Regression', lastName: 'Client',
      email: 'regression.client@example.test', phone: '+385990000000',
      dateOfBirth: '1990-05-14',
      goals: 'Lose 5kg', injuries: 'Left knee',
      dietNotes: 'Vegetarian', notes: 'Prefers mornings',
    });

    expect(res.status).toBe(201);
    createdId = res.body.client.id;

    const stored = await auth(request(app).get(`/api/clients/${createdId}`));
    const client = stored.body.client;
    expect(client.goals).toBe('Lose 5kg');
    expect(client.injuries).toBe('Left knee');
    expect(client.diet_notes).toBe('Vegetarian');
    expect(client.notes).toBe('Prefers mornings');
    expect(String(client.date_of_birth)).toContain('1990');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a trainer can always get their own data out', () => {
  test('export is reachable on the Free plan (GDPR Art. 20)', async () => {
    // The fixture tenant is on the Free plan, which has has_export = false.
    // The endpoint used to sit behind checkFeatureAccess('export') and answered
    // 403 for every new signup.
    const res = await auth(request(app).get('/api/export'));
    expect(res.status).toBe(200);
  });

  test('a single client export is reachable too', async () => {
    const res = await auth(request(app).get(`/api/export/clients/${T.clientId}`));
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the session the browser holds stays consistent', () => {
  test('/auth/validate reports emailVerified, like login and register do', async () => {
    // The field was missing here only, so it vanished from the client's user
    // object on every page reload and anything keyed on it changed behaviour
    // depending on how the user arrived at the page.
    const res = await auth(request(app).get('/api/auth/validate'));
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('emailVerified');
  });
});
