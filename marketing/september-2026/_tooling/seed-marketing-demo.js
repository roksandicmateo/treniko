// TRENIKO — synthetic demo tenant for the September 2026 marketing capture.
//
// LOCAL DEVELOPMENT ONLY. It talks to http://localhost:3000 and refuses to run
// against anything else. It registers its own tenant, so it cannot read or
// write another trainer's records.
//
// Every value below is invented: the trainer and the clients are fictional
// people, the addresses are in the reserved example.com domain, there are no
// phone numbers, no dates of birth, no injuries and no health notes, and the
// payment amounts illustrate a price list that does not exist anywhere.
//
//   node marketing/september-2026/_tooling/seed-marketing-demo.js
//
const API = 'http://localhost:3000/api';
if (!API.startsWith('http://localhost:')) throw new Error('local only');

const EMAIL = 'alex.morgan@example.com';
const PASS = 'MarketingDemo!2026';

const j = async (path, opts = {}, token) => {
  const r = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers || {}),
    },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const iso = (d) => d.toISOString().slice(0, 10);
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

// Fictional clients. First name + surname, both invented.
const CLIENTS = [
  { first: 'James',  last: 'Carter',  goals: 'Back to three sessions a week after a long break' },
  { first: 'Emma',   last: 'Wilson',  goals: 'Strength base before the spring season' },
  { first: 'Daniel', last: 'Brooks',  goals: 'Consistency — two sessions a week, every week' },
  { first: 'Sophie', last: 'Taylor',  goals: 'General conditioning and better sleep' },
  { first: 'Olivia', last: 'Bennett', goals: 'Return to running, gradually' },
  { first: 'Marcus', last: 'Reid',    goals: 'Lower-body strength' },
];

(async () => {
  // ── 1. tenant ──────────────────────────────────────────────────────────────
  const reg = await j('/auth/register', { method: 'POST', body: JSON.stringify({
    email: EMAIL, password: PASS,
    firstName: 'Alex', lastName: 'Morgan',
    businessName: 'Morgan Performance',
  })});
  console.log('register:', reg.status, reg.body.message || '');

  const login = await j('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASS })});
  if (login.status !== 200) { console.error('login failed', login.status, login.body); process.exit(1); }
  const token = login.body.token || login.body.accessToken;
  if (!token) { console.error('no token in', Object.keys(login.body)); process.exit(1); }
  console.log('logged in');
  await j('/auth/accept-dpa', { method: 'POST', body: JSON.stringify({ accepted: true }) }, token);

  // ── 2. clients ─────────────────────────────────────────────────────────────
  const existing = await j('/clients', {}, token);
  const have = new Map((existing.body.clients || []).map((c) => [c.first_name + ' ' + c.last_name, c]));
  const clients = [];
  for (const c of CLIENTS) {
    const key = c.first + ' ' + c.last;
    if (have.has(key)) { clients.push(have.get(key)); continue; }
    const r = await j('/clients', { method: 'POST', body: JSON.stringify({
      firstName: c.first, lastName: c.last,
      email: `${c.first.toLowerCase()}.${c.last.toLowerCase()}@example.com`,
      goals: c.goals,
    })}, token);
    if (r.status !== 201) { console.log('client', key, r.status, r.body.message || r.body.error); continue; }
    clients.push(r.body.client);
  }
  console.log('clients:', clients.length);

  // ── 3. packages ────────────────────────────────────────────────────────────
  const wanted = [
    { name: '10 Session Pack', description: 'Ten one-to-one sessions', price: 450, totalSessions: 10 },
    { name: '20 Session Pack', description: 'Twenty one-to-one sessions', price: 840, totalSessions: 20 },
    { name: '5 Session Starter', description: 'Five sessions to get going', price: 240, totalSessions: 5 },
  ];
  const existingPkgs = (await j('/packages', {}, token)).body;
  const pkgList = existingPkgs.packages || existingPkgs || [];
  const packages = [];
  for (const w of wanted) {
    const found = (Array.isArray(pkgList) ? pkgList : []).find((p) => p.name === w.name);
    if (found) { packages.push(found); continue; }
    const r = await j('/packages', { method: 'POST', body: JSON.stringify({
      ...w, currency: 'EUR', packageType: 'session_based',
    })}, token);
    if (r.status >= 300) { console.log('package', w.name, r.status, r.body.message || r.body.error); continue; }
    packages.push(r.body.package || r.body);
  }
  console.log('packages:', packages.length);

  // ── 4. sessions — a full, plausible week around today ───────────────────────
  const SLOTS = [
    [0, '07:00', '08:00', 0], [0, '09:00', '10:00', 1], [0, '18:00', '19:00', 2],
    [1, '07:00', '08:00', 3], [1, '17:00', '18:00', 4],
    [2, '08:00', '09:00', 5], [2, '18:30', '19:30', 0],
    [3, '07:30', '08:30', 1], [3, '12:00', '13:00', 2],
    [4, '09:00', '10:00', 3], [4, '17:30', '18:30', 4],
    [5, '08:00', '09:00', 5],
    [-1, '07:00', '08:00', 0], [-2, '18:00', '19:00', 1], [-3, '09:00', '10:00', 2],
    [-4, '07:30', '08:30', 3], [-6, '17:00', '18:00', 4],
  ];
  const before = (await j(`/sessions?startDate=${day(-10)}&endDate=${day(10)}`, {}, token)).body;
  const already = (before.sessions || []).length;
  let made = 0;
  if (already < 5) {
    for (const [off, s, e, ci] of SLOTS) {
      const c = clients[ci];
      if (!c) continue;
      const r = await j('/sessions', { method: 'POST', body: JSON.stringify({
        clientId: c.id, sessionDate: day(off), startTime: s, endTime: e, sessionType: 'personal',
      })}, token);
      if (r.status === 201) made++;
      else if (made === 0) console.log('session', r.status, r.body.message || r.body.error);
    }
  }
  console.log('sessions created:', made, '(already had', already + ')');

  console.log('\nDEMO LOGIN  ', EMAIL, '/', PASS);
})();
