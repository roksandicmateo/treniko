// Second pass on the synthetic demo tenant: assign packages, burn some sessions
// so a countdown is visible, and record illustrative payments. Local dev only.
const API = 'http://localhost:3000/api';
const EMAIL = 'demo.trainer@example.com', PASS = 'DemoTreniko!2026';
const j = async (p, o = {}, t) => {
  const r = await fetch(API + p, { ...o, headers: { 'Content-Type':'application/json', ...(t?{Authorization:'Bearer '+t}:{}) , ...(o.headers||{}) }});
  return { status: r.status, body: await r.json().catch(()=>({})) };
};
const iso = d => d.toISOString().slice(0,10);
const ago = n => { const d = new Date(); d.setDate(d.getDate()-n); return iso(d); };

(async () => {
  const l = await j('/auth/login', { method:'POST', body: JSON.stringify({ email:EMAIL, password:PASS })});
  const t = l.body.token;
  const cs = (await j('/clients', {}, t)).body.clients || [];
  const pkgRes = await j('/packages', {}, t);
  const pkgs = pkgRes.body.packages || pkgRes.body || [];
  const pkg = (Array.isArray(pkgs) ? pkgs : []).find(p => p.name === '10 Session Pack') || pkgs[0];
  if (!pkg) { console.error('no package', pkgRes.body); process.exit(1); }
  console.log('clients', cs.length, 'package', pkg.name);

  // used-session counts chosen so one client is near the end (drives the
  // "package is ending soon" alert) and the rest sit mid-package
  const USED = [8, 3, 5, 1, 6];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const have = (await j(`/clients/${c.id}/packages`, {}, t)).body;
    const list = have.clientPackages || have.packages || have || [];
    let cp = Array.isArray(list) ? list[0] : null;
    if (!cp) {
      const r = await j(`/clients/${c.id}/packages`, { method:'POST', body: JSON.stringify({ packageId: pkg.id, startDate: ago(30) })}, t);
      cp = r.body.clientPackage || r.body;
      if (r.status >= 300) { console.log('assign', c.first_name, r.status, r.body); continue; }
    }
    const already = Number(cp.sessions_used || 0);
    for (let k = already; k < USED[i]; k++) await j(`/clients/${c.id}/packages/${cp.id}/use-session`, { method:'POST', body:'{}' }, t);

    const pays = (await j(`/clients/${c.id}/payments`, {}, t)).body;
    const plist = pays.payments || [];
    if (!plist.length) {
      const method = ['bank_transfer','cash','card','bank_transfer','card'][i];
      const r = await j(`/clients/${c.id}/payments`, { method:'POST', body: JSON.stringify({
        amount: 450, paymentDate: ago(30 - i*3), paymentMethod: method,
        status: i === 4 ? 'pending' : 'paid', clientPackageId: cp.id,
      })}, t);
      if (r.status >= 300) console.log('pay', c.first_name, r.status, r.body);
    }
    console.log(c.first_name, '-> used', USED[i]);
  }
  const d = await j('/dashboard', {}, t);
  console.log('dashboard', d.status, JSON.stringify(d.body).slice(0, 400));
})();
