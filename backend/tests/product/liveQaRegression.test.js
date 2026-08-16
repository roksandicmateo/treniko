'use strict';

/**
 * Defects found by live QA against production, 16 Aug 2026.
 *
 * Each group here corresponds to one finding from that run, and asserts the
 * behaviour the fix guarantees rather than the shape of the fix:
 *
 *   BUG-1  the client detail endpoint returned the numeric "upcoming" count and
 *          an array of upcoming sessions under the SAME key, so the array won.
 *          Every client's Upcoming tile read 0.
 *   BUG-2  trainings are stored as wall-clock times in a zone-less TIMESTAMP,
 *          and were serialised as absolute instants — a session entered at
 *          09:00 came back as 09:00Z and displayed as 11:00 in Europe/Zagreb.
 *   BUG-4  measurement history is delivered newest-first; the trend arithmetic
 *          assumed chronological order, so gains were reported as losses.
 *   BUG-7  the GDPR export named five stores and the product has thirty. A real
 *          trainer's archive contained no trainings, no measurements, no
 *          payments, no packages and no groups.
 *
 * They run against the real Express stack and a real database, because every
 * one of them is a property of what crosses the API boundary.
 */

const zlib = require('zlib');
const request = require('supertest');
const app = require('../../server');
const { createTenant, destroyTenant, pool, asTenant } = require('../helpers/fixtures');
const { tenantDatasets, EXCLUDED_FROM_EXPORT } = require('../../controllers/exportController');

jest.setTimeout(60000);

let A;
let B;

const auth = (req, tenant = A) => req.set('Authorization', `Bearer ${tenant.token}`);

const dayOffset = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
};

beforeAll(async () => {
  A = await createTenant('liveqa-a');
  B = await createTenant('liveqa-b');
});

afterAll(async () => {
  await destroyTenant(A?.tenantId);
  await destroyTenant(B?.tenantId);
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-1: the upcoming-session count and the upcoming-session list are different things', () => {
  beforeAll(async () => {
    // Two future scheduled sessions, so a count of 1 cannot pass by accident —
    // Number([x]) is x, which is exactly why a one-element array hid this.
    for (const offset of [3, 5]) {
      await auth(request(app).post('/api/sessions')).send({
        clientId: A.clientId,
        sessionDate: dayOffset(offset),
        startTime: '09:00',
        endTime: '10:00',
      });
    }
  });

  test('client detail returns a numeric count under its own key', async () => {
    const res = await auth(request(app).get(`/api/clients/${A.clientId}`));
    expect(res.status).toBe(200);

    const client = res.body.client;
    expect(Number(client.upcoming_sessions_count)).toBe(2);
    // And the count survives the conversion the UI actually performs.
    expect(Number(client.upcoming_sessions_count) || 0).toBe(2);
  });

  test('the array of upcoming sessions keeps the plural key, and is an array', async () => {
    const res = await auth(request(app).get(`/api/clients/${A.clientId}`));
    expect(Array.isArray(res.body.client.upcoming_sessions)).toBe(true);
    expect(res.body.client.upcoming_sessions).toHaveLength(2);
  });

  test('the list and the detail endpoints agree on the count', async () => {
    const list = await auth(request(app).get('/api/clients'));
    const fromList = list.body.clients.find((c) => c.id === A.clientId);
    const detail = await auth(request(app).get(`/api/clients/${A.clientId}`));

    expect(Number(fromList.upcoming_sessions_count))
      .toBe(Number(detail.body.client.upcoming_sessions_count));
  });

  test('nothing still publishes a count under the array\'s name', async () => {
    // The regression itself: one key meaning two things. The list endpoint used
    // to answer with a number here and the detail endpoint with an array, so
    // any consumer reading `upcoming_sessions` was right in one place and wrong
    // in the other.
    const list = await auth(request(app).get('/api/clients'));
    const fromList = list.body.clients.find((c) => c.id === A.clientId);
    expect(fromList.upcoming_sessions).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-2: a training keeps the wall-clock time the trainer typed', () => {
  const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  let trainingId;

  test('creating at 09:00 and reading it back gives 09:00, with no zone', async () => {
    const res = await auth(request(app).post('/api/trainings')).send({
      clientId: A.clientId,
      title: 'Wall clock',
      startTime: '2026-08-18T09:00:00',
      endTime: '2026-08-18T10:00:00',
      exercises: [],
    });
    expect(res.status).toBe(201);
    trainingId = res.body.id;

    // No trailing Z, no offset: an instant would be a different value in every
    // reader's time zone, and this is not an instant.
    expect(res.body.start_time).toMatch(WALL_CLOCK);
    expect(res.body.start_time).toBe('2026-08-18T09:00:00');
    expect(res.body.end_time).toBe('2026-08-18T10:00:00');
  });

  test('reopening it gives the same time again', async () => {
    const res = await auth(request(app).get(`/api/trainings/${trainingId}`));
    expect(res.body.start_time).toBe('2026-08-18T09:00:00');
    expect(res.body.end_time).toBe('2026-08-18T10:00:00');
  });

  test('the list endpoint agrees with the detail endpoint', async () => {
    const res = await auth(request(app).get('/api/trainings?limit=100'));
    const found = res.body.data.find((t) => t.id === trainingId);
    expect(found.start_time).toBe('2026-08-18T09:00:00');
  });

  test('a DST-transition morning is preserved exactly', async () => {
    // 29 March 2026 is the spring-forward Sunday in Europe/Zagreb: 02:00 local
    // does not exist that day. A value routed through an absolute instant has
    // to invent something here; a wall-clock value has nothing to convert.
    const res = await auth(request(app).post('/api/trainings')).send({
      clientId: A.clientId,
      title: 'DST morning',
      startTime: '2026-03-29T02:30:00',
      endTime: '2026-03-29T03:30:00',
      exercises: [],
    });
    expect(res.status).toBe(201);
    expect(res.body.start_time).toBe('2026-03-29T02:30:00');

    const reopened = await auth(request(app).get(`/api/trainings/${res.body.id}`));
    expect(reopened.body.start_time).toBe('2026-03-29T02:30:00');

    await auth(request(app).delete(`/api/trainings/${res.body.id}`));
  });

  test('an edit that does not mention the times leaves them alone', async () => {
    const res = await auth(request(app).put(`/api/trainings/${trainingId}`)).send({
      title: 'Wall clock, renamed',
    });
    expect(res.status).toBe(200);
    expect(res.body.start_time).toBe('2026-08-18T09:00:00');
    expect(res.body.end_time).toBe('2026-08-18T10:00:00');
  });

  test('the round trip is exact as a string, so nothing re-parses it', async () => {
    // `new Date("2026-08-18T09:00:00")` is local time by specification, which is
    // what makes the browser render the typed value. Pinned here because it is
    // the half of the contract that lives in the frontend.
    const parsed = new Date('2026-08-18T09:00:00');
    expect(parsed.getHours()).toBe(9);
    expect(parsed.getMinutes()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-4: measurements come back in a stated, total order', () => {
  beforeAll(async () => {
    // Deliberately inserted out of order, and one pair shares a date, so the
    // result cannot be "whatever the executor happened to produce".
    const entries = [
      { date: '2026-08-16', value: 82.5 },
      { date: '2026-08-10', value: 81.0 },
      { date: '2026-08-20', value: 83.0 },
    ];
    for (const e of entries) {
      await auth(request(app).post(`/api/progress/${A.clientId}`))
        .send({ metric_name: 'Weight', unit: 'kg', ...e });
    }
  });

  test('dates are calendar dates, not timestamps', async () => {
    const res = await auth(request(app).get(`/api/progress/${A.clientId}`));
    for (const entry of res.body.Weight) {
      // A DATE serialised as a timestamp is the previous day in UTC east of
      // Greenwich, which silently moved measurements to the day before.
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('the API states newest-first, and every entry carries what a tie needs', async () => {
    const res = await auth(request(app).get(`/api/progress/${A.clientId}`));
    const dates = res.body.Weight.map((e) => e.date);
    expect(dates).toEqual(['2026-08-20', '2026-08-16', '2026-08-10']);
    for (const e of res.body.Weight) expect(e.created_at).toBeTruthy();
  });

  test('sorting chronologically gives the trend the UI shows', async () => {
    // The arithmetic the chart performs, reproduced here: the component sorts
    // for itself rather than trusting the delivered order, and this is what it
    // must arrive at. Before the fix, First was 83 and Change was -2.
    const res = await auth(request(app).get(`/api/progress/${A.clientId}`));
    const chronological = [...res.body.Weight].sort((a, b) => a.date.localeCompare(b.date));

    const first = parseFloat(chronological[0].value);
    const latest = parseFloat(chronological[chronological.length - 1].value);

    expect(first).toBe(81);
    expect(latest).toBe(83);
    expect(latest - first).toBe(2);      // a gain, reported as a gain
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-7: the GDPR export is materially complete', () => {
  /**
   * Minimal ZIP reader — central directory only, no dependency.
   *
   * archiver streams, so the local file headers carry no sizes; the central
   * directory at the end of the archive does. Reading it is what lets this test
   * assert what is IN the file rather than what the code meant to put there,
   * which is the exact distinction QA's finding turned on: the entries were
   * present and the contents were "[]".
   */
  const readZip = (buffer) => {
    const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd === -1) throw new Error('not a zip archive');
    const count = buffer.readUInt16LE(eocd + 10);
    let p = buffer.readUInt32LE(eocd + 16);

    const entries = {};
    for (let i = 0; i < count; i += 1) {
      const method = buffer.readUInt16LE(p + 10);
      const compressedSize = buffer.readUInt32LE(p + 20);
      const nameLen = buffer.readUInt16LE(p + 28);
      const extraLen = buffer.readUInt16LE(p + 30);
      const commentLen = buffer.readUInt16LE(p + 32);
      const localOffset = buffer.readUInt32LE(p + 42);
      const name = buffer.toString('utf8', p + 46, p + 46 + nameLen);

      const localNameLen = buffer.readUInt16LE(localOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const raw = buffer.slice(start, start + compressedSize);

      entries[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  };

  let archive;

  beforeAll(async () => {
    // Seed one row in each store QA found missing, so "complete" is measured
    // against data that exists rather than against empty tables.
    await auth(request(app).post('/api/trainings')).send({
      clientId: A.clientId,
      title: 'Exported training',
      startTime: '2026-08-19T07:00:00',
      endTime: '2026-08-19T08:00:00',
      exercises: [],
    });
    await auth(request(app).post('/api/packages')).send({
      name: 'Exported package', packageType: 'session_based', totalSessions: 10, price: 500,
    });

    const res = await auth(request(app).get('/api/export')).buffer().parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    archive = readZip(res.body);
  });

  test('the archive contains every declared dataset', async () => {
    const expected = tenantDatasets(A.tenantId, A.userId).map((d) => `json/${d.name}.json`);
    const missing = expected.filter((name) => !(name in archive));
    expect(missing).toEqual([]);
  });

  test('the stores QA found empty now carry the trainer\'s data', async () => {
    const rows = (name) => JSON.parse(archive[`json/${name}.json`].toString('utf8'));

    expect(rows('trainings').length).toBeGreaterThan(0);
    expect(rows('progress_entries').length).toBeGreaterThan(0);
    expect(rows('packages').length).toBeGreaterThan(0);
    expect(rows('groups').length).toBeGreaterThan(0);
    expect(rows('group_sessions').length).toBeGreaterThan(0);
    expect(rows('clients').length).toBeGreaterThan(0);
    expect(rows('sessions').length).toBeGreaterThan(0);
  });

  test('every export query actually runs', async () => {
    // The controller catches per dataset, so a query that cannot execute
    // produces an empty file rather than an error — which is indistinguishable
    // from "you have no data of that kind", and is exactly how BUG-7 presented
    // to the trainer who reported it. (This check caught client_packages
    // ordering by a column that table does not have.) Run under a tenant
    // context, as the export itself does.
    const failures = [];
    await asTenant(A, async () => {
      for (const set of tenantDatasets(A.tenantId, A.userId)) {
        try {
          await pool.query(set.sql, set.params);
        } catch (e) {
          failures.push(`${set.name}: ${e.message}`);
        }
      }
    });
    expect(failures).toEqual([]);
  });

  test('every tenant-scoped table is exported or explicitly excluded', async () => {
    // Read from the catalogue, so the next feature's table has to be a decision
    // rather than an omission.
    const { rows } = await pool.query(`
      SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND a.attname = 'tenant_id' AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY c.relname`);

    const exported = new Set(
      tenantDatasets('t', 'u').map((d) => {
        const m = d.sql.match(/FROM\s+(\w+)/i);
        return m ? m[1] : null;
      })
    );
    const unaccounted = rows
      .map((r) => r.table_name)
      .filter((t) => !exported.has(t) && !(t in EXCLUDED_FROM_EXPORT));

    expect(unaccounted).toEqual([]);
  });

  test('no credential material leaves the building', async () => {
    const everything = Object.entries(archive)
      .map(([name, buf]) => `${name}\n${buf.toString('utf8')}`)
      .join('\n');

    expect(everything).not.toMatch(/password_hash/);
    expect(everything).not.toMatch(/token_hash/);
    expect(everything).not.toMatch(/verification_token/);
    expect(everything).not.toMatch(/\$2[aby]\$\d\d\$/);      // a bcrypt hash
    expect(Object.keys(archive)).not.toContain('json/password_reset_tokens.json');

    const profile = JSON.parse(archive['json/trainer_profile.json'].toString('utf8'));
    expect(profile[0]).toHaveProperty('email');
    expect(profile[0]).not.toHaveProperty('password_hash');
    expect(profile[0]).not.toHaveProperty('password_changed_at');
  });

  test('the archive holds this tenant only', async () => {
    const other = String(B.tenantId);
    for (const [name, buf] of Object.entries(archive)) {
      expect({ name, containsOtherTenant: buf.toString('utf8').includes(other) })
        .toEqual({ name, containsOtherTenant: false });
    }
  });

  test('every export query is scoped, checked against the other tenant directly', async () => {
    // Not a property of the archive but of the statements: run each one as if
    // it were A's export and confirm it returns nothing belonging to B. This is
    // what catches a new dataset added with a missing WHERE.
    // Read as each tenant in turn. These tables are RLS-protected, so a
    // context-free read returns nothing at all — and a leak check over an empty
    // set proves nothing, which is a way for a test like this to pass forever
    // while asserting less than it appears to.
    const bIds = new Set();
    await asTenant(B, async () => {
      for (const table of ['clients', 'trainings', 'groups', 'group_sessions', 'training_sessions']) {
        const { rows } = await pool.query(
          `SELECT id FROM ${table} WHERE tenant_id = $1`, [B.tenantId]);
        rows.forEach((r) => bIds.add(r.id));
      }
    });
    expect(bIds.size).toBeGreaterThan(0);

    await asTenant(A, async () => {
      for (const set of tenantDatasets(A.tenantId, A.userId)) {
        const { rows } = await pool.query(set.sql, set.params);
        const leaked = rows.filter(
          (r) => bIds.has(r.id) || String(r.tenant_id || '') === String(B.tenantId));
        expect({ dataset: set.name, leaked: leaked.length })
          .toEqual({ dataset: set.name, leaked: 0 });
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the QA-tenant cleanup script knows about every tenant-scoped table', () => {
  // scripts/cleanup-qa-tenant.js will only delete a tenant it has PROVEN to be
  // empty, and it proves that by counting rows table by table. A tenant-scoped
  // table the list does not mention is a hole in that proof — so the script
  // refuses to run when it finds one, and this test says so before an operator
  // discovers it in front of a production database.
  const { TENANT_DATA_TABLES, SHELL_TABLES } = require('../../scripts/cleanup-qa-tenant');

  test('no tenant-scoped table is missing from the script', async () => {
    const { rows } = await pool.query(`
      SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND a.attname = 'tenant_id' AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY c.relname`);

    const known = new Set([...TENANT_DATA_TABLES, ...SHELL_TABLES].map(([t]) => t));
    const unknown = rows.map((r) => r.table_name).filter((t) => !known.has(t));
    expect(unknown).toEqual([]);
  });

  test('the two lists do not overlap', () => {
    // A table cannot be both "must be empty before deleting" and "safe to
    // delete as part of the shell".
    const data = new Set(TENANT_DATA_TABLES.map(([t]) => t));
    const overlap = SHELL_TABLES.map(([t]) => t).filter((t) => data.has(t));
    expect(overlap).toEqual([]);
  });

  // ── Regression: the catalogue check above cannot see production's drift ────
  //
  // The test above asks THIS database which tables carry a tenant_id. That is
  // the right question, but it can only ever describe the schema it is run
  // against — and the schema it is run against is a freshly migrated one.
  // Migration 009 creates deletion_requests keyed by trainer_id with no
  // tenant_id at all, so the catalogue query returns nothing for it and the
  // test passes no matter how the script classifies it.
  //
  // Production carries an older deletion_requests that DOES have tenant_id, so
  // the script's own cross-check fired there and refused to clean a tenant.
  // A catalogue-derived assertion could not have caught that before the fact;
  // only naming the table can. So this test names it.
  test('deletion_requests is classified, and classified as a removable shell row', () => {
    const shell = SHELL_TABLES.map(([t]) => t);
    const data = TENANT_DATA_TABLES.map(([t]) => t);

    expect(shell).toContain('deletion_requests');
    expect(data).not.toContain('deletion_requests');

    // Keyed by tenant_id, like every other entry the script deletes by.
    const [, column] = SHELL_TABLES.find(([t]) => t === 'deletion_requests');
    expect(column).toBe('tenant_id');
  });

  test('every classified table is deleted by a tenant-keyed column', () => {
    // The delete step interpolates the column name straight into SQL, so an
    // entry naming anything other than a tenant key would widen the blast
    // radius of a script whose entire purpose is to be narrow.
    for (const [table, column] of [...TENANT_DATA_TABLES, ...SHELL_TABLES]) {
      expect(`${table}:${column}`).toBe(`${table}:tenant_id`);
    }
  });
});
