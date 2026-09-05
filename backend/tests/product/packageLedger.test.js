'use strict';

/**
 * Package consumption — the money-critical path.
 *
 * Every group below corresponds to a defect the product audit found in the
 * bookkeeping that decides how many sessions a client has left. They are
 * written against the running Express stack and a real database with row-level
 * security in force, because the defects are in the interaction between the
 * status change and the ledger, which a mock cannot reproduce.
 *
 *   FIFO                    the NEWEST active package was charged first, so a
 *                           client who renewed early spent the new block while
 *                           the old one expired holding sessions they paid for.
 *   outcome reporting       completing a session for a client with no package,
 *                           or an exhausted one, answered exactly as if a
 *                           session had been charged. The trainer worked for
 *                           free and the product said nothing.
 *   the ledger is the truth `sessions_used` was incremented by hand and could
 *                           drift from the rows meant to explain it; it is now
 *                           recomputed from them on every write.
 *   group attendance        charged nothing at all.
 *   no-show policy          whether a no-show costs a session is the trainer's
 *                           decision and is now recorded per session.
 *   manual adjustment       correcting a balance required inventing a session.
 */

const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool, queryAs } = require('../helpers/fixtures');

jest.setTimeout(30000);

let T;
const auth = (req) => req.set('Authorization', `Bearer ${T.token}`);

const dayOffset = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
};

/** A client of this tenant, created fresh so each group starts from zero. */
const newClient = async (firstName) => {
  const res = await auth(request(app).post('/api/clients'))
    .send({ firstName, lastName: 'Ledger', email: `${firstName.toLowerCase()}.ledger@example.test` });
  return res.body.client.id;
};

const newTemplate = async (name, totalSessions, durationDays = null) => {
  const res = await auth(request(app).post('/api/packages')).send({
    name, packageType: 'session_based', totalSessions, price: 400, durationDays,
  });
  return res.body.package.id;
};

const assign = async (clientId, packageId, body = {}) => {
  const res = await auth(request(app).post(`/api/clients/${clientId}/packages`))
    .send({ packageId, ...body });
  return res.body.package;
};

const newSession = async (clientId, offset, start = '07:00') => {
  const res = await auth(request(app).post('/api/sessions')).send({
    clientId, sessionDate: dayOffset(offset), startTime: start, endTime: '23:30', force: true,
  });
  return res.body.session.id;
};

const readPackage = async (clientPackageId) => {
  const { rows } = await queryAs(T,
    'SELECT * FROM client_packages WHERE id = $1', [clientPackageId]);
  return rows[0];
};

beforeAll(async () => { T = await createTenant('ledger'); });
afterAll(async () => { await destroyTenant(T?.tenantId); await pool.end(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('FIFO: the package that expires first is charged first', () => {
  let clientId, older, newer;

  beforeAll(async () => {
    clientId = await newClient('Fifo');
    // Assigned in the order a renewal happens: the old block first, then a new
    // one bought before the old one was finished. `assigned_at DESC` used to
    // pick the second one.
    older = await assign(clientId, await newTemplate('Old 5-pack', 5, 30));
    newer = await assign(clientId, await newTemplate('New 10-pack', 10, 90));
  });

  test('both packages are active', async () => {
    expect((await readPackage(older.id)).status).toBe('active');
    expect((await readPackage(newer.id)).status).toBe('active');
  });

  test('completing a session charges the block that expires sooner', async () => {
    const sessionId = await newSession(clientId, 1);
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.packageOutcome).toBe('charged');
    expect(res.body.clientPackage.id).toBe(older.id);
    expect((await readPackage(older.id)).sessions_used).toBe(1);
    expect((await readPackage(newer.id)).sessions_used).toBe(0);
  });

  test('the newer block is only charged once the older one is used up', async () => {
    for (let i = 0; i < 4; i += 1) {
      const sessionId = await newSession(clientId, 2 + i);
      await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    }
    // Older is now 5/5 and closed out; the next one has to come off the newer.
    expect((await readPackage(older.id)).sessions_used).toBe(5);
    expect((await readPackage(older.id)).status).toBe('completed');

    const sessionId = await newSession(clientId, 10);
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    expect(res.body.clientPackage.id).toBe(newer.id);
    expect((await readPackage(newer.id)).sessions_used).toBe(1);
  });

  test('a package with no end date waits behind one that can expire', async () => {
    const client2 = await newClient('Openended');
    const openEnded = await assign(client2, await newTemplate('Open 10-pack', 10, null));
    const expiring  = await assign(client2, await newTemplate('Expiring 3-pack', 3, 14));

    const sessionId = await newSession(client2, 1, '06:00');
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });

    expect(res.body.clientPackage.id).toBe(expiring.id);
    expect((await readPackage(openEnded.id)).sessions_used).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the trainer is told when nothing could be charged', () => {
  test('a client with no package: the session is kept, and says so', async () => {
    const clientId = await newClient('Nopackage');
    const sessionId = await newSession(clientId, 1);

    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('completed');   // never blocked
    expect(res.body.packageOutcome).toBe('no_active_package');
    expect(res.body.clientPackage).toBeNull();
  });

  test('an exhausted package is reported as exhausted, not as missing', async () => {
    const clientId = await newClient('Exhausted');
    await assign(clientId, await newTemplate('Single', 1));

    const first = await newSession(clientId, 1, '06:00');
    const firstRes = await auth(request(app).put(`/api/sessions/${first}`)).send({ status: 'completed' });
    expect(firstRes.body.packageOutcome).toBe('charged');

    const second = await newSession(clientId, 2, '06:00');
    const secondRes = await auth(request(app).put(`/api/sessions/${second}`)).send({ status: 'completed' });
    expect(secondRes.body.packageOutcome).toBe('package_exhausted');
  });

  test('an expired package is reported as expired', async () => {
    const clientId = await newClient('Expired');
    const cp = await assign(clientId, await newTemplate('Expiring', 10, 30));
    await queryAs(T,
      `UPDATE client_packages SET status = 'expired', end_date = CURRENT_DATE - 1 WHERE id = $1`,
      [cp.id]);

    const sessionId = await newSession(clientId, 1, '06:00');
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    expect(res.body.packageOutcome).toBe('package_expired');
  });

  test('charging reports charged, with the new balance attached', async () => {
    const clientId = await newClient('Charged');
    const cp = await assign(clientId, await newTemplate('Ten', 10));
    const sessionId = await newSession(clientId, 1, '06:00');

    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    expect(res.body.packageOutcome).toBe('charged');
    expect(res.body.clientPackage.id).toBe(cp.id);
    expect(res.body.clientPackage.sessions_used).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the counter always equals the ledger', () => {
  let clientId, cp;

  beforeAll(async () => {
    clientId = await newClient('Reconcile');
    cp = await assign(clientId, await newTemplate('Recon 10-pack', 10));
  });

  const ledgerTotal = async () => {
    const { rows } = await queryAs(T,
      'SELECT COALESCE(SUM(quantity),0)::int AS total FROM package_session_usage WHERE client_package_id = $1',
      [cp.id]);
    return rows[0].total;
  };

  test('after a charge', async () => {
    const sessionId = await newSession(clientId, 1, '06:00');
    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    expect((await readPackage(cp.id)).sessions_used).toBe(await ledgerTotal());
  });

  test('after a repeat of the same completion (idempotent)', async () => {
    const sessionId = await newSession(clientId, 2, '06:00');
    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    const afterFirst = (await readPackage(cp.id)).sessions_used;

    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ isCompleted: true });

    expect((await readPackage(cp.id)).sessions_used).toBe(afterFirst);
    expect(await ledgerTotal()).toBe(afterFirst);
  });

  test('after a reversal', async () => {
    const sessionId = await newSession(clientId, 3, '06:00');
    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    const charged = (await readPackage(cp.id)).sessions_used;

    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'cancelled' });
    expect((await readPackage(cp.id)).sessions_used).toBe(charged - 1);
    expect(await ledgerTotal()).toBe(charged - 1);
  });

  test('a failed update charges nothing — the whole thing rolls back', async () => {
    const before = (await readPackage(cp.id)).sessions_used;
    const sessionId = await newSession(clientId, 4, '06:00');

    // An invalid status is refused before anything is written.
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`))
      .send({ status: 'definitely-not-a-status' });
    expect(res.status).toBe(400);

    expect((await readPackage(cp.id)).sessions_used).toBe(before);
    expect(await ledgerTotal()).toBe(before);
  });

  test('reopening a package that was closed out reactivates it', async () => {
    const soloClient = await newClient('Reopen');
    const solo = await assign(soloClient, await newTemplate('Solo', 1));
    const sessionId = await newSession(soloClient, 1, '06:00');

    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'completed' });
    expect((await readPackage(solo.id)).status).toBe('completed');

    await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'scheduled' });
    const reopened = await readPackage(solo.id);
    expect(reopened.status).toBe('active');
    expect(reopened.sessions_used).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('group attendance consumes packages too', () => {
  let groupId, groupSessionId, memberA, memberB, packageA, packageB;

  beforeAll(async () => {
    memberA = await newClient('Groupa');
    memberB = await newClient('Groupb');
    packageA = await assign(memberA, await newTemplate('Group A 10-pack', 10));
    packageB = await assign(memberB, await newTemplate('Group B 10-pack', 10));

    const group = await auth(request(app).post('/api/groups')).send({ name: 'Morning bootcamp' });
    groupId = group.body.group.id;
    await auth(request(app).post(`/api/groups/${groupId}/members`)).send({ clientId: memberA });
    await auth(request(app).post(`/api/groups/${groupId}/members`)).send({ clientId: memberB });

    const gs = await auth(request(app).post(`/api/groups/${groupId}/sessions`)).send({
      sessionDate: dayOffset(3), startTime: '19:00', endTime: '20:00',
    });
    groupSessionId = gs.body.groupSession.id;
  });

  test('marking one member present charges only that member', async () => {
    const res = await auth(
      request(app).put(`/api/groups/${groupId}/sessions/${groupSessionId}/attendance/${memberA}`)
    ).send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.packageOutcome).toBe('charged');
    expect((await readPackage(packageA.id)).sessions_used).toBe(1);
    expect((await readPackage(packageB.id)).sessions_used).toBe(0);
  });

  test('marking the same member present again does not charge twice', async () => {
    await auth(
      request(app).put(`/api/groups/${groupId}/sessions/${groupSessionId}/attendance/${memberA}`)
    ).send({ status: 'completed' });
    expect((await readPackage(packageA.id)).sessions_used).toBe(1);
  });

  test('each member is charged against their own package', async () => {
    await auth(
      request(app).put(`/api/groups/${groupId}/sessions/${groupSessionId}/attendance/${memberB}`)
    ).send({ status: 'completed' });
    expect((await readPackage(packageB.id)).sessions_used).toBe(1);
  });

  test('taking attendance back gives the session back', async () => {
    const res = await auth(
      request(app).put(`/api/groups/${groupId}/sessions/${groupSessionId}/attendance/${memberA}`)
    ).send({ status: 'scheduled' });

    expect(res.body.packageOutcome).toBe('released');
    expect((await readPackage(packageA.id)).sessions_used).toBe(0);
  });

  test('a member with no package still gets marked present, and is reported', async () => {
    const memberC = await newClient('Groupc');
    await auth(request(app).post(`/api/groups/${groupId}/members`)).send({ clientId: memberC });
    const gs = await auth(request(app).post(`/api/groups/${groupId}/sessions`)).send({
      sessionDate: dayOffset(4), startTime: '19:00', endTime: '20:00',
    });

    const res = await auth(
      request(app).put(`/api/groups/${groupId}/sessions/${gs.body.groupSession.id}/attendance/${memberC}`)
    ).send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.attendance.status).toBe('completed');
    expect(res.body.packageOutcome).toBe('no_active_package');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('no-show is the trainer\'s decision, and it is recorded', () => {
  let clientId, cp;

  beforeAll(async () => {
    clientId = await newClient('Noshow');
    cp = await assign(clientId, await newTemplate('No-show 10-pack', 10));
  });

  test('by default a no-show costs nothing', async () => {
    const sessionId = await newSession(clientId, 1, '06:00');
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'no_show' });

    expect(res.status).toBe(200);
    expect(res.body.packageOutcome).toBeUndefined();
    expect((await readPackage(cp.id)).sessions_used).toBe(0);
  });

  test('the trainer can charge it', async () => {
    const sessionId = await newSession(clientId, 2, '06:00');
    const res = await auth(request(app).put(`/api/sessions/${sessionId}`))
      .send({ status: 'no_show', chargeNoShow: true });

    expect(res.body.packageOutcome).toBe('charged');
    expect((await readPackage(cp.id)).sessions_used).toBe(1);
    expect(res.body.session.no_show_charged).toBe(true);
  });

  test('editing a charged no-show does not silently refund it', async () => {
    const sessionId = await newSession(clientId, 3, '06:00');
    await auth(request(app).put(`/api/sessions/${sessionId}`))
      .send({ status: 'no_show', chargeNoShow: true });
    const afterCharge = (await readPackage(cp.id)).sessions_used;

    // A later edit that touches only the note must not change the balance.
    await auth(request(app).put(`/api/sessions/${sessionId}`))
      .send({ status: 'no_show', chargeNoShow: true, notes: 'Called at 18:55' });

    expect((await readPackage(cp.id)).sessions_used).toBe(afterCharge);
  });

  test('changing a charged no-show back to scheduled refunds it', async () => {
    const sessionId = await newSession(clientId, 5, '06:00');
    await auth(request(app).put(`/api/sessions/${sessionId}`))
      .send({ status: 'no_show', chargeNoShow: true });
    const charged = (await readPackage(cp.id)).sessions_used;

    const res = await auth(request(app).put(`/api/sessions/${sessionId}`)).send({ status: 'scheduled' });
    expect(res.body.packageOutcome).toBe('released');
    expect((await readPackage(cp.id)).sessions_used).toBe(charged - 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('manual adjustment', () => {
  let clientId, cp;

  beforeAll(async () => {
    clientId = await newClient('Adjust');
    cp = await assign(clientId, await newTemplate('Adjust 10-pack', 10));
  });

  test('a credit gives sessions back, with the reason on the record', async () => {
    const res = await auth(request(app).post(`/api/clients/${clientId}/packages/${cp.id}/adjust`))
      .send({ quantity: -2, reason: 'Bolovanje, dogovoreno' });

    expect(res.status).toBe(200);
    expect(res.body.package.sessions_used).toBe(0);   // clamped, never negative

    const ledger = await auth(request(app).get(`/api/clients/${clientId}/packages/${cp.id}/ledger`));
    expect(ledger.body.entries[0].kind).toBe('adjustment');
    expect(ledger.body.entries[0].reason).toBe('Bolovanje, dogovoreno');
    expect(ledger.body.entries[0].quantity).toBe(-2);
  });

  test('a charge takes sessions off', async () => {
    const res = await auth(request(app).post(`/api/clients/${clientId}/packages/${cp.id}/adjust`))
      .send({ quantity: 3, reason: 'Tri treninga upisana naknadno' });
    expect(res.body.package.sessions_used).toBe(1);   // -2 + 3
  });

  test('a reason is required', async () => {
    const res = await auth(request(app).post(`/api/clients/${clientId}/packages/${cp.id}/adjust`))
      .send({ quantity: 1 });
    expect(res.status).toBe(400);
  });

  test('zero is refused', async () => {
    const res = await auth(request(app).post(`/api/clients/${clientId}/packages/${cp.id}/adjust`))
      .send({ quantity: 0, reason: 'nothing' });
    expect(res.status).toBe(400);
  });

  test('another tenant cannot adjust this package', async () => {
    const other = await createTenant('ledger-intruder');
    try {
      const res = await request(app)
        .post(`/api/clients/${clientId}/packages/${cp.id}/adjust`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ quantity: 5, reason: 'not mine' });
      expect(res.status).toBe(404);
      expect((await readPackage(cp.id)).sessions_used).toBe(1);
    } finally {
      await destroyTenant(other.tenantId);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('package status cannot be set to something no screen looks for', () => {
  test('an unknown status is refused', async () => {
    const clientId = await newClient('Status');
    const cp = await assign(clientId, await newTemplate('Status 10-pack', 10));

    const res = await auth(request(app).put(`/api/clients/${clientId}/packages/${cp.id}`))
      .send({ status: 'paused-ish' });

    expect(res.status).toBe(400);
    expect((await readPackage(cp.id)).status).toBe('active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('assignment records the deal that was actually made', () => {
  test('price and session count can differ from the template', async () => {
    const clientId = await newClient('Deal');
    const templateId = await newTemplate('Standard 10-pack', 10);

    const res = await auth(request(app).post(`/api/clients/${clientId}/packages`))
      .send({ packageId: templateId, price: 350.5, totalSessions: 12 });

    expect(res.status).toBe(201);
    expect(Number(res.body.package.price)).toBe(350.5);
    expect(res.body.package.total_sessions).toBe(12);
  });

  test('marking it paid records a payment linked to the package', async () => {
    const clientId = await newClient('Paid');
    const templateId = await newTemplate('Paid 10-pack', 10);

    const res = await auth(request(app).post(`/api/clients/${clientId}/packages`))
      .send({ packageId: templateId, price: 300, markPaid: true, paymentMethod: 'bank_transfer' });

    expect(res.status).toBe(201);
    expect(res.body.payment).toBeTruthy();
    expect(Number(res.body.payment.amount)).toBe(300);
    expect(res.body.payment.client_package_id).toBe(res.body.package.id);

    const payments = await auth(request(app).get(`/api/clients/${clientId}/payments`));
    expect(payments.body.payments).toHaveLength(1);
    expect(Number(payments.body.summary.total_paid)).toBe(300);
  });

  test('an unusable price is refused rather than guessed at', async () => {
    const clientId = await newClient('Badprice');
    const templateId = await newTemplate('Bad 10-pack', 10);

    const res = await auth(request(app).post(`/api/clients/${clientId}/packages`))
      .send({ packageId: templateId, price: 'three hundred' });

    expect(res.status).toBe(400);
  });

  test('the start date is the trainer\'s calendar date, not a UTC one', async () => {
    const clientId = await newClient('Dates');
    const templateId = await newTemplate('Dated 10-pack', 10);

    const res = await auth(request(app).post(`/api/clients/${clientId}/packages`))
      .send({ packageId: templateId });

    const { rows } = await queryAs(T,
      `SELECT start_date::text AS start_date, CURRENT_DATE::text AS today
         FROM client_packages WHERE id = $1`, [res.body.package.id]);
    expect(rows[0].start_date).toBe(rows[0].today);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ad-hoc group sessions', () => {
  let a, b, packageA, packageB;

  beforeAll(async () => {
    a = await newClient('Adhoca');
    b = await newClient('Adhocb');
    packageA = await assign(a, await newTemplate('Ad-hoc A 10-pack', 10));
    packageB = await assign(b, await newTemplate('Ad-hoc B 10-pack', 10));
  });

  test('can be created at all (was: 400 on every attempt)', async () => {
    const res = await auth(request(app).post('/api/sessions')).send({
      isGroup: true,
      groupTitle: 'Utorak duo',
      attendees: [a, b],
      sessionDate: dayOffset(6),
      startTime: '17:00',
      endTime: '18:00',
      force: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.session.is_group).toBe(true);
    expect(res.body.session.group_title).toBe('Utorak duo');
    expect(res.body.session.attendee_count).toBe(2);
  });

  test('every participant is on the attendee list', async () => {
    const created = await auth(request(app).post('/api/sessions')).send({
      isGroup: true, attendees: [a, b],
      sessionDate: dayOffset(7), startTime: '17:00', endTime: '18:00', force: true,
    });
    const attendees = await auth(
      request(app).get(`/api/sessions/${created.body.session.id}/attendees`)
    );
    expect(attendees.body.attendees.map((x) => x.client_id).sort()).toEqual([a, b].sort());
  });

  test('completing it charges every participant, each from their own package', async () => {
    const created = await auth(request(app).post('/api/sessions')).send({
      isGroup: true, attendees: [a, b],
      sessionDate: dayOffset(8), startTime: '17:00', endTime: '18:00', force: true,
    });
    const before = {
      a: (await readPackage(packageA.id)).sessions_used,
      b: (await readPackage(packageB.id)).sessions_used,
    };

    const res = await auth(request(app).put(`/api/sessions/${created.body.session.id}`))
      .send({ status: 'completed' });

    expect(res.body.packageOutcome).toBe('charged');
    expect((await readPackage(packageA.id)).sessions_used).toBe(before.a + 1);
    expect((await readPackage(packageB.id)).sessions_used).toBe(before.b + 1);
  });

  test('undoing it gives every participant their session back', async () => {
    const created = await auth(request(app).post('/api/sessions')).send({
      isGroup: true, attendees: [a, b],
      sessionDate: dayOffset(9), startTime: '17:00', endTime: '18:00', force: true,
    });
    await auth(request(app).put(`/api/sessions/${created.body.session.id}`)).send({ status: 'completed' });
    const charged = {
      a: (await readPackage(packageA.id)).sessions_used,
      b: (await readPackage(packageB.id)).sessions_used,
    };

    await auth(request(app).put(`/api/sessions/${created.body.session.id}`)).send({ status: 'cancelled' });

    expect((await readPackage(packageA.id)).sessions_used).toBe(charged.a - 1);
    expect((await readPackage(packageB.id)).sessions_used).toBe(charged.b - 1);
  });

  test('a group session with no participants is refused, clearly', async () => {
    const res = await auth(request(app).post('/api/sessions')).send({
      isGroup: true, attendees: [],
      sessionDate: dayOffset(10), startTime: '17:00', endTime: '18:00', force: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/participant/i);
  });

  test('another tenant\'s client cannot be added as a participant', async () => {
    const other = await createTenant('adhoc-intruder');
    try {
      const res = await auth(request(app).post('/api/sessions')).send({
        isGroup: true, attendees: [a, other.clientId],
        sessionDate: dayOffset(11), startTime: '17:00', endTime: '18:00', force: true,
      });
      expect(res.status).toBe(404);

      const { rows } = await queryAs(T,
        'SELECT id FROM session_attendees WHERE client_id = $1', [other.clientId]);
      expect(rows).toHaveLength(0);
    } finally {
      await destroyTenant(other.tenantId);
    }
  });

  test('an individual session still needs a client', async () => {
    const res = await auth(request(app).post('/api/sessions')).send({
      sessionDate: dayOffset(12), startTime: '17:00', endTime: '18:00', force: true,
    });
    expect(res.status).toBe(400);
  });
});
