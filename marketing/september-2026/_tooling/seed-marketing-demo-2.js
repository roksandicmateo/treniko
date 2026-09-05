// TRENIKO — second pass on the September 2026 marketing demo tenant.
//
// LOCAL DEVELOPMENT ONLY. Assigns packages, spends some of their sessions so a
// countdown and a "running low" state are visible, records illustrative
// payments, and logs completed workouts so the Progress screen has a real
// chart to draw. Every figure is invented.
//
//   node marketing/september-2026/_tooling/seed-marketing-demo-2.js
//
const API = 'http://localhost:3000/api';
if (!API.startsWith('http://localhost:')) throw new Error('local only');
const EMAIL = 'alex.morgan@example.com', PASS = 'MarketingDemo!2026';

const j = async (p, o = {}, t) => {
  const r = await fetch(API + p, { ...o, headers: {
    'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(o.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const iso = (d) => d.toISOString().slice(0, 10);
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const at = (n, hh) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(hh, 0, 0, 0); return d.toISOString(); };

// Sessions already spent per client. James is deliberately near the end of his
// pack so the "2 sessions left" state is real and not staged.
const USED = { James: 8, Emma: 3, Daniel: 14, Sophie: 1, Olivia: 4, Marcus: 6 };
const PACK = { James: '10 Session Pack', Emma: '10 Session Pack', Daniel: '20 Session Pack',
               Sophie: '5 Session Starter', Olivia: '10 Session Pack', Marcus: '10 Session Pack' };

const EXERCISES = [
  { name: 'Back Squat',      category: 'Strength', muscleGroup: 'Legs',  equipment: 'Barbell' },
  { name: 'Bench Press',     category: 'Strength', muscleGroup: 'Chest', equipment: 'Barbell' },
  { name: 'Deadlift',        category: 'Strength', muscleGroup: 'Back',  equipment: 'Barbell' },
  { name: 'Overhead Press',  category: 'Strength', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { name: 'Romanian Deadlift', category: 'Strength', muscleGroup: 'Hamstrings', equipment: 'Barbell' },
];

// Weeks back → weight per exercise. A steady, unremarkable progression.
const PROGRESSION = {
  'Back Squat':        [70, 72.5, 75, 77.5, 80, 82.5, 85, 87.5],
  'Bench Press':       [55, 55, 57.5, 60, 60, 62.5, 65, 65],
  'Deadlift':          [90, 95, 95, 100, 105, 105, 110, 115],
  'Overhead Press':    [35, 35, 37.5, 37.5, 40, 40, 42.5, 42.5],
  'Romanian Deadlift': [60, 62.5, 65, 65, 70, 72.5, 72.5, 75],
};

(async () => {
  const l = await j('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASS }) });
  const t = l.body.token;
  if (!t) { console.error('login failed', l.status, l.body); process.exit(1); }

  const clients = (await j('/clients', {}, t)).body.clients || [];
  const pkgBody = (await j('/packages', {}, t)).body;
  const packages = pkgBody.packages || pkgBody || [];
  const byName = new Map(packages.map((p) => [p.name, p]));
  console.log('clients', clients.length, 'packages', packages.length);

  // ── packages, spent sessions, payments ─────────────────────────────────────
  for (const c of clients) {
    const pkg = byName.get(PACK[c.first_name]);
    if (!pkg) continue;
    const have = (await j(`/clients/${c.id}/packages`, {}, t)).body;
    const list = have.clientPackages || have.packages || (Array.isArray(have) ? have : []);
    let cp = Array.isArray(list) && list.length ? list[0] : null;
    if (!cp) {
      const r = await j(`/clients/${c.id}/packages`, { method: 'POST', body: JSON.stringify({
        packageId: pkg.id, startDate: ago(35) }) }, t);
      if (r.status >= 300) { console.log('assign', c.first_name, r.status, r.body.message || r.body.error); continue; }
      cp = r.body.clientPackage || r.body;
    }
    const already = Number(cp.sessions_used || 0);
    for (let k = already; k < (USED[c.first_name] || 0); k++) {
      await j(`/clients/${c.id}/packages/${cp.id}/use-session`, { method: 'POST', body: '{}' }, t);
    }

    const pays = (await j(`/clients/${c.id}/payments`, {}, t)).body;
    if (!(pays.payments || []).length) {
      const i = clients.indexOf(c);
      const r = await j(`/clients/${c.id}/payments`, { method: 'POST', body: JSON.stringify({
        amount: Number(pkg.price), paymentDate: ago(35 - i * 4),
        paymentMethod: ['bank_transfer', 'card', 'bank_transfer', 'cash', 'card', 'bank_transfer'][i % 6],
        status: c.first_name === 'Marcus' ? 'pending' : 'paid',
        clientPackageId: cp.id,
      }) }, t);
      if (r.status >= 300) console.log('pay', c.first_name, r.status, r.body.message || r.body.error);
    }
    console.log(c.first_name, '→', PACK[c.first_name], 'used', USED[c.first_name]);
  }

  // ── exercise library ───────────────────────────────────────────────────────
  const exBody = (await j('/exercises', {}, t)).body;
  let exercises = exBody.exercises || (Array.isArray(exBody) ? exBody : []);
  for (const e of EXERCISES) {
    if (exercises.find((x) => x.name === e.name)) continue;
    const r = await j('/exercises', { method: 'POST', body: JSON.stringify(e) }, t);
    if (r.status === 201) exercises.push(r.body);
    else console.log('exercise', e.name, r.status, r.body.error);
  }
  console.log('exercises:', exercises.length);
  const exByName = new Map(exercises.map((e) => [e.name, e]));

  // ── completed workouts for the two clients used in Progress screenshots ────
  for (const name of ['James', 'Emma']) {
    const c = clients.find((x) => x.first_name === name);
    if (!c) continue;
    const existing = (await j(`/trainings?clientId=${c.id}`, {}, t)).body;
    const count = (existing.trainings || (Array.isArray(existing) ? existing : [])).length;
    if (count >= 6) { console.log(name, 'already has', count, 'trainings'); continue; }

    const plan = name === 'James'
      ? ['Back Squat', 'Bench Press', 'Romanian Deadlift']
      : ['Deadlift', 'Overhead Press', 'Back Squat'];

    for (let w = 7; w >= 0; w--) {
      const start = at(w * 7 + 1, 7);
      const end = at(w * 7 + 1, 8);
      const exs = plan.map((n) => {
        const base = PROGRESSION[n][7 - w];
        const weight = name === 'Emma' ? Math.round((base * 0.7) * 2) / 2 : base;
        return {
          exerciseId: exByName.get(n).id, exerciseName: n,
          sets: [
            { reps: 8, weight, rpe: 7 },
            { reps: 8, weight, rpe: 8 },
            { reps: 6, weight, rpe: 8 },
          ],
        };
      });
      const r = await j('/trainings', { method: 'POST', body: JSON.stringify({
        clientId: c.id, title: 'Strength session', workoutType: 'Gym',
        startTime: start, endTime: end, exercises: exs,
      }) }, t);
      if (r.status !== 201) { console.log('training', name, r.status, r.body.error); continue; }
      const id = r.body.id || (r.body.training && r.body.training.id);
      if (id) await j(`/trainings/${id}`, { method: 'PUT', body: JSON.stringify({ isCompleted: true }) }, t);
    }
    console.log(name, '→ 8 completed workouts logged');
  }

  const d = (await j('/dashboard', {}, t)).body;
  console.log('\ndashboard stats:', JSON.stringify(d.dashboard && d.dashboard.stats));
})();
