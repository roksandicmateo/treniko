// TRENIKO — third pass on the September 2026 marketing demo tenant.
//
// LOCAL DEVELOPMENT ONLY. Brings each client's package usage up to its target
// by reading the current count off the API and spending the difference, so the
// "sessions left" figures in the screenshots are produced by the application
// itself rather than written into the database by hand.
//
//   node marketing/september-2026/_tooling/seed-marketing-demo-3.js
//
const API = 'http://localhost:3000/api';
if (!API.startsWith('http://localhost:')) throw new Error('local only');
const EMAIL = 'alex.morgan@example.com', PASS = 'MarketingDemo!2026';

// James is deliberately near the end of his pack: 8 of 10 spent leaves the
// 2-remaining state that the "who is about to run out" posts talk about.
const TARGET = { James: 8, Emma: 3, Daniel: 14, Sophie: 1, Olivia: 4, Marcus: 6 };

(async () => {
  const l = await fetch(API + '/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }) }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + l.token };

  const clients = (await fetch(API + '/clients', { headers: H }).then((r) => r.json())).clients || [];
  for (const c of clients) {
    const target = TARGET[c.first_name];
    if (target === undefined) continue;
    const body = await fetch(`${API}/clients/${c.id}/packages`, { headers: H }).then((r) => r.json());
    const list = body.packages || body.clientPackages || [];
    const cp = list.find((p) => p.status === 'active') || list[0];
    if (!cp) { console.log(c.first_name, '— no package'); continue; }
    let used = Number(cp.sessions_used || 0);
    while (used < target) {
      const r = await fetch(`${API}/clients/${c.id}/packages/${cp.id}/use-session`, {
        method: 'POST', headers: H, body: '{}' });
      if (!r.ok) { console.log(c.first_name, 'use-session', r.status); break; }
      const out = await r.json();
      const next = Number((out.package || {}).sessions_used ?? used + 1);
      if (next <= used) break;
      used = next;
    }
    console.log(c.first_name, '→', used, '/', cp.total_sessions, 'used');
  }
})();

// ── body metrics ─────────────────────────────────────────────────────────────
// Invented figures, gentle and unremarkable, so the Progress tab has a line to
// draw instead of an empty state. Weight in kg, one reading a fortnight.
(async () => {
  const l = await fetch(API + '/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }) }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + l.token };
  const clients = (await fetch(API + '/clients', { headers: H }).then((r) => r.json())).clients || [];
  const SERIES = {
    James: { metric: 'Weight', unit: 'kg', values: [88.4, 87.9, 87.2, 86.8, 86.1, 85.6] },
    Emma:  { metric: 'Weight', unit: 'kg', values: [64.2, 64.0, 63.7, 63.8, 63.4, 63.1] },
  };
  const dayIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  for (const [first, s] of Object.entries(SERIES)) {
    const c = clients.find((x) => x.first_name === first);
    if (!c) continue;
    const have = await fetch(`${API}/progress/${c.id}`, { headers: H }).then((r) => r.json()).catch(() => ({}));
    if (have && have[s.metric] && have[s.metric].length >= s.values.length) { console.log(first, 'metrics already present'); continue; }
    for (let i = 0; i < s.values.length; i++) {
      const r = await fetch(`${API}/progress/${c.id}`, { method: 'POST', headers: H, body: JSON.stringify({
        metricName: s.metric, value: s.values[i], unit: s.unit, date: dayIso((s.values.length - 1 - i) * 14),
      }) });
      if (!r.ok) { console.log(first, 'metric', r.status); break; }
    }
    console.log(first, '→', s.values.length, s.metric, 'entries');
  }
})();
