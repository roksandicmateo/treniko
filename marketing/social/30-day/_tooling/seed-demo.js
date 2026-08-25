// TRENIKO — synthetic demo tenant for marketing capture.
// Runs against the LOCAL development API only (http://localhost:3000).
// Every value below is invented for illustration: reserved @example.com
// addresses, placeholder first names with an initial for the surname, no phone
// numbers, no health notes, no real payment details. It creates its own tenant,
// so it cannot touch anyone else's records.
const API = 'http://localhost:3000/api';
const EMAIL = 'demo.trainer@example.com';
const PASS  = 'DemoTreniko!2026';

const j = async (path, opts = {}, token) => {
  const r = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

const iso = d => d.toISOString().slice(0, 10);
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

(async () => {
  // 1. tenant
  let reg = await j('/auth/register', { method: 'POST', body: JSON.stringify({
    email: EMAIL, password: PASS, firstName: 'Demo', lastName: 'Trainer',
    businessName: 'Demo Studio',
  })});
  if (reg.status === 409) console.log('tenant already exists — reusing');
  else console.log('register:', reg.status, reg.body.message || '');

  const login = await j('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASS })});
  if (login.status !== 200) { console.error('login failed', login.status, login.body); process.exit(1); }
  const token = login.body.token || login.body.accessToken || (login.body.data && login.body.data.token);
  if (!token) { console.error('no token in', Object.keys(login.body)); process.exit(1); }
  console.log('logged in');

  const dpa = await j('/auth/accept-dpa', { method: 'POST', body: JSON.stringify({ accepted: true }) }, token);
  console.log('dpa:', dpa.status);

  // 2. clients — placeholder names, surname reduced to an initial
  const NAMES = [
    ['Alex', 'M.'], ['Jordan', 'T.'], ['Sam', 'K.'],
    ['Riley', 'P.'], ['Casey', 'B.'], ['Morgan', 'L.'],
  ];
  const clients = [];
  const existing = await j('/clients', {}, token);
  const have = new Map((existing.body.clients || []).map(c => [c.first_name + ' ' + c.last_name, c]));
  for (const [first, last] of NAMES) {
    if (have.has(first + ' ' + last)) { clients.push(have.get(first + ' ' + last)); continue; }
    const r = await j('/clients', { method: 'POST', body: JSON.stringify({
      firstName: first, lastName: last,
      email: `${first.toLowerCase()}@example.com`,
      goals: 'Strength and consistency',
    })}, token);
    if (r.status !== 201) { console.log('client', first, r.status, r.body.message); continue; }
    clients.push(r.body.client);
  }
  console.log('clients:', clients.length);

  // 3. a session package, then assign it to clients
  const pkgs = await j('/packages', {}, token);
  let pkg = (pkgs.body.packages || pkgs.body || []).find?.(p => p.name === '10 Session Pack');
  if (!pkg) {
    const r = await j('/packages', { method: 'POST', body: JSON.stringify({
      name: '10 Session Pack', description: 'Ten one-to-one sessions',
      price: 450, currency: 'EUR', packageType: 'session_based', totalSessions: 10,
    })}, token);
    pkg = r.body.package || r.body;
    console.log('package:', r.status);
  }

  // 4. sessions across the week, no two overlapping
  const SLOTS = [
    [0, '07:00', '08:00'], [0, '09:00', '10:00'], [0, '18:00', '19:00'],
    [1, '07:00', '08:00'], [1, '17:00', '18:00'],
    [2, '08:00', '09:00'], [2, '18:30', '19:30'],
    [3, '07:30', '08:30'], [3, '12:00', '13:00'],
    [4, '09:00', '10:00'], [4, '17:30', '18:30'],
    [-1, '07:00', '08:00'], [-2, '18:00', '19:00'], [-3, '09:00', '10:00'],
  ];
  let made = 0;
  for (let i = 0; i < SLOTS.length; i++) {
    const [off, s, e] = SLOTS[i];
    const c = clients[i % clients.length];
    if (!c) break;
    const r = await j('/sessions', { method: 'POST', body: JSON.stringify({
      clientId: c.id, sessionDate: day(off), startTime: s, endTime: e,
      sessionType: 'personal',
    })}, token);
    if (r.status === 201) made++;
  }
  console.log('sessions created:', made);
  console.log('\nDEMO LOGIN  ', EMAIL, '/', PASS);
})();
