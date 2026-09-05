// TRENIKO — product screenshot capture for the September 2026 campaign.
//
// LOCAL DEVELOPMENT ONLY. Drives the installed Chrome through puppeteer-core
// against http://localhost:5173, logged in as the synthetic demo tenant created
// by seed-marketing-demo.js. Screenshots are page captures: no browser chrome,
// no address bar, no operating-system window is ever in shot.
//
// The language is forced to English and the theme to light before the first
// paint, so no Croatian string and no dark-mode flash can reach an asset.
//
//   node marketing/september-2026/_tooling/capture.js
//
// puppeteer-core is deliberately NOT a project dependency: nothing in the
// application or its build imports it, and a marketing tool should not put a
// browser in the app's dependency tree. Resolve it from the environment
// (PUPPETEER_MODULE / NODE_PATH) and fall back to a plain require.
function loadPuppeteer() {
  const tried = [];
  for (const c of [process.env.PUPPETEER_MODULE, 'puppeteer-core', 'puppeteer'].filter(Boolean)) {
    try { return require(c); } catch (e) { tried.push(c); }
  }
  throw new Error('puppeteer-core not found. Install it outside the repo and point PUPPETEER_MODULE at it, ' +
                  'or run with NODE_PATH=<dir>/node_modules. Tried: ' + tried.join(', '));
}
const puppeteer = loadPuppeteer();
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = 'http://localhost:5173';
const API = 'http://localhost:3000/api';
const EMAIL = 'alex.morgan@example.com', PASS = 'MarketingDemo!2026';
const OUT = process.argv[2] || 'marketing/september-2026/screenshots';

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const auth = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  if (!auth.token) { console.error('login failed', auth); process.exit(1); }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'],
  });

  const shot = async (name, url, viewport, opts = {}) => {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument((token, user) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', user);
      localStorage.setItem('treniko_language', 'en');
      localStorage.setItem('treniko_theme', 'light');
      // The cookie banner is answered the way this session answers every consent
      // prompt — necessary only, nothing optional — so it is not sitting over
      // the product in the capture.
      localStorage.setItem('treniko_cookie_consent', JSON.stringify({
        necessary: true, analytics: false, preferences: false,
        timestamp: new Date().toISOString(),
      }));
      localStorage.setItem('treniko_verify_banner_dismissed', '1');
    }, auth.token, JSON.stringify(auth.user || {}));
    await page.goto(APP + url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(opts.wait || 2500);
    if (opts.before) await opts.before(page);
    // Development artefacts get removed — but NOT `[data-vite-dev-id]`, which is
    // how Vite injects the application's own stylesheet in dev. Removing that
    // strips every style off the page and yields an unstyled capture.
    await page.evaluate(() => {
      document.querySelectorAll('#vite-error-overlay,vite-error-overlay').forEach((n) => n.remove());
      document.body.style.caretColor = 'transparent';
    });
    await sleep(400);
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file, fullPage: !!opts.fullPage });
    const t = await page.evaluate(() => document.body.innerText);
    await page.close();
    console.log('✔', name, fs.statSync(file).size + ' bytes');
    return t;
  };

  const clients = await fetch(API + '/clients', { headers: { Authorization: 'Bearer ' + auth.token } })
    .then((r) => r.json()).then((d) => d.clients || []);
  const james = clients.find((c) => c.first_name === 'James');

  // ── desktop ────────────────────────────────────────────────────────────────
  await shot('desktop-dashboard', '/dashboard', DESKTOP);
  await shot('desktop-calendar', '/dashboard/calendar', DESKTOP, { wait: 3000 });
  await shot('desktop-clients', '/dashboard/clients', DESKTOP);

  // The week ahead, not the week behind: the arrow moves the calendar on one
  // week, where the seeded sessions actually are. Taller viewport so the
  // evening slots are in frame and not cut off at the fold.
  await shot('desktop-calendar-week-ahead', '/dashboard/calendar',
    { ...DESKTOP, height: 1250 }, {
      wait: 3000,
      before: async (page) => {
        await page.evaluate(() => {
          const today = [...document.querySelectorAll('button')]
            .find((b) => b.textContent.trim() === 'Today');
          const next = today && today.nextElementSibling;
          if (next) next.click();
        });
        await sleep(2000);
      },
    });

  // The clients table without the "Last session" column. That column is
  // `hidden lg:table-cell`, so a narrower viewport drops it — and it currently
  // shows the most recent session on record, which can be a FUTURE date. See
  // the defect note in SEPTEMBER_MARKETING_COMPLETE.md. Nothing that reads
  // wrong goes into an asset.
  await shot('desktop-clients-narrow', '/dashboard/clients',
    { width: 1000, height: 900, deviceScaleFactor: 2 });
  await shot('desktop-client-detail', `/dashboard/clients/${james.id}`, DESKTOP, { wait: 3000 });
  await shot('desktop-packages', '/dashboard/packages', DESKTOP);
  // NOT CAPTURED (yet): /dashboard/progress and the client page's
  // Progress → Strength sub-tab.
  //
  // Both were withheld from the September set because of product defects, not
  // because of anything about the screens: the Progress chart labelled its axis
  // with Croatian months in an English UI and its Total Hours tile read 72.0 h
  // for eight one-hour sessions, and the Strength sub-tab threw
  // `TypeError: entries.map is not a function` behind the error boundary.
  //
  // **All three defects are fixed** — see the product-fix commit and
  // backend/migrations/042. The screens are safe to capture again; they are left
  // out here only because adding them is a marketing decision for the next
  // content session, not a side effect of a bug-fix sprint. Re-enable by adding
  // the two `shot(...)` calls back.

  await shot('desktop-trainings', '/dashboard/trainings', DESKTOP);
  await shot('desktop-groups', '/dashboard/groups', DESKTOP);

  // A tab on the client page. The tab strip has role="tablist".
  const tabShot = (name, clientId, label, opts = {}) =>
    shot(name, `/dashboard/clients/${clientId}`, opts.viewport || DESKTOP, {
      wait: 3000,
      before: async (page) => {
        const ok = await page.evaluate((want) => {
          const tab = [...document.querySelectorAll('[role="tab"]')]
            .find((b) => b.textContent.trim().toLowerCase() === want.toLowerCase());
          if (tab) { tab.click(); return true; }
          return false;
        }, label);
        if (!ok) console.warn('  ! tab not found:', label);
        await sleep(2200);
      },
    });

  await tabShot('desktop-client-billing', james.id, 'Billing');   // who has paid
  await tabShot('desktop-client-packages', james.id, 'Packages'); // sessions left
  await tabShot('desktop-client-progress', james.id, 'Progress');

  // ── mobile ─────────────────────────────────────────────────────────────────
  await shot('mobile-dashboard', '/dashboard', MOBILE);
  await shot('mobile-calendar', '/dashboard/calendar', MOBILE, { wait: 3000 });
  await shot('mobile-clients', '/dashboard/clients', MOBILE);
  await shot('mobile-client-detail', `/dashboard/clients/${james.id}`, MOBILE, { wait: 3000 });
  await shot('mobile-packages', '/dashboard/packages', MOBILE);

  await browser.close();
  console.log('\nAll captures in', OUT);
})();
