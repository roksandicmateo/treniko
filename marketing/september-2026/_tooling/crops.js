// TRENIKO — component-level captures for the September 2026 campaign.
//
// LOCAL DEVELOPMENT ONLY. Same demo tenant as capture.js. Where capture.js
// photographs whole screens, this photographs single cards — the dashboard's
// attention list, the clients table, the package counter — because a whole
// 1440-wide screen shrunk into a 1080-wide feed post is unreadable on a phone,
// and one enlarged card is not.
//
// Regions are not hardcoded pixel rectangles: each card is located in the DOM
// by its own heading and clipped to its measured bounding box, so a layout
// change moves the crop instead of silently cutting the card in half.
//
//   node marketing/september-2026/_tooling/crops.js
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
const OUT = 'marketing/september-2026/screenshots/crops';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const auth = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  if (!auth.token) { console.error('login failed'); process.exit(1); }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'],
  });

  const open = async (url, viewport, before) => {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument((token, user) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', user);
      localStorage.setItem('treniko_language', 'en');
      localStorage.setItem('treniko_theme', 'light');
      localStorage.setItem('treniko_cookie_consent', JSON.stringify({
        necessary: true, analytics: false, preferences: false, timestamp: new Date().toISOString() }));
      localStorage.setItem('treniko_verify_banner_dismissed', '1');
    }, auth.token, JSON.stringify(auth.user || {}));
    await page.goto(APP + url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2500);
    if (before) await before(page);
    return page;
  };

  // Photograph the card that contains `heading`. The element is located in the
  // DOM, tagged, and handed to puppeteer, which scrolls it into view and clips
  // to its own box — measuring a rectangle by hand and screenshotting it later
  // goes wrong the moment the scroll position changes underneath you.
  //
  // Fixed and sticky chrome (the phone's bottom navigation, the plan banner) is
  // hidden first: it paints over whatever is beneath it, and a crop of one card
  // should contain one card.
  const clipCard = async (page, name, heading, { levels = null, pad = 0 } = {}) => {
    const found = await page.evaluate((h, levels) => {
      const want = h.trim().toLowerCase();
      const el = [...document.querySelectorAll('h1,h2,h3,h4,div,span,p,th,td,label')]
        .find((n) => n.childElementCount === 0 && n.textContent.trim().toLowerCase() === want);
      if (!el) return false;
      let node = el;
      if (levels) { for (let i = 0; i < levels && node.parentElement; i++) node = node.parentElement; }
      else {
        while (node.parentElement) {
          node = node.parentElement;
          const cs = getComputedStyle(node);
          if (parseFloat(cs.borderRadius) >= 8 &&
              (cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0)) break;
        }
      }
      document.querySelectorAll('[data-crop-target]').forEach((n) => n.removeAttribute('data-crop-target'));
      node.setAttribute('data-crop-target', '1');
      for (const n of document.querySelectorAll('*')) {
        if (n === node || node.contains(n) || n.contains(node)) continue;
        const cs = getComputedStyle(n);
        if (cs.position === 'fixed' || cs.position === 'sticky') n.style.visibility = 'hidden';
      }
      const r = node.getBoundingClientRect();
      return r.width >= 40 && r.height >= 40;
    }, heading, levels);
    if (!found) { console.warn('  ! card not found:', name, heading); return; }
    const handle = await page.$('[data-crop-target]');
    await sleep(300);
    const file = path.join(OUT, name + '.png');
    await handle.screenshot({ path: file, captureBeyondViewport: true });
    const box = await handle.boundingBox();
    await handle.dispose();
    console.log('✔', name, Math.round(box.width) + '×' + Math.round(box.height));
  };

  const clients = await fetch(API + '/clients', { headers: { Authorization: 'Bearer ' + auth.token } })
    .then((r) => r.json()).then((d) => d.clients || []);
  const james = clients.find((c) => c.first_name === 'James');

  const DESK = { width: 1440, height: 1100, deviceScaleFactor: 3 };
  const NARROW = { width: 1000, height: 1000, deviceScaleFactor: 3 };
  const PHONE = { width: 390, height: 844, deviceScaleFactor: 4, isMobile: true, hasTouch: true };

  // Click a tab on the client page and wait for it to settle.
  const clientTab = (label) => async (page) => {
    await page.evaluate((want) => {
      const tab = [...document.querySelectorAll('[role="tab"]')]
        .find((b) => b.textContent.trim() === want);
      if (tab) tab.click();
    }, label);
    await sleep(2200);
  };



  // Dashboard — the three cards the campaign leans on
  let p = await open('/dashboard', DESK);
  await clipCard(p, 'dash-attention', 'Needs your attention');
  await clipCard(p, 'dash-today', "Today's Sessions");
  await clipCard(p, 'dash-upcoming', 'Upcoming — Next 7 Days');
  await p.close();

  // Phone dashboard — the attention list as a trainer actually sees it
  p = await open('/dashboard', PHONE);
  await clipCard(p, 'phone-attention', 'Needs your attention');
  await p.close();

  // Clients table, narrow so the "Last session" column is not rendered
  p = await open('/dashboard/clients', NARROW);
  await clipCard(p, 'clients-table', 'NAME', { levels: 6 });
  await p.close();

  // The phone versions are what most of the feed assets use. A 1440-wide table
  // scaled into a 1080 canvas leaves body text at about 12 px; the same card
  // captured at phone width lands near 27 px, which is legible in a feed.
  p = await open('/dashboard/clients', PHONE);
  await clipCard(p, 'phone-clients', 'NAME', { levels: 6 });
  await p.close();

  p = await open('/dashboard', PHONE);
  await clipCard(p, 'phone-today', "Today's Sessions");
  await p.close();

  p = await open(`/dashboard/clients/${james.id}`, PHONE, clientTab('Packages'));
  await clipCard(p, 'phone-package', '10 Session Pack', { levels: 3 });
  await clipCard(p, 'phone-client-summary', 'REMAINING', { levels: 3 });
  await p.close();

  p = await open(`/dashboard/clients/${james.id}`, PHONE, clientTab('Billing'));
  await clipCard(p, 'phone-billing', 'TOTAL PAID', { levels: 2 });
  await p.close();

  // Calendar, the week ahead
  p = await open('/dashboard/calendar', { ...DESK, height: 1300 }, async (page) => {
    await page.evaluate(() => {
      const today = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Today');
      if (today && today.nextElementSibling) today.nextElementSibling.click();
    });
    await sleep(2000);
  });
  await clipCard(p, 'calendar-week', 'Sep 6 – 12, 2026', { levels: 2 });
  await p.close();

  // Packages page — the price list
  p = await open('/dashboard/packages', DESK);
  await clipCard(p, 'package-card', '10 Session Pack');
  await p.close();

  // A client's package counter and billing summary
  p = await open(`/dashboard/clients/${james.id}`, DESK, clientTab('Packages'));
  await clipCard(p, 'client-summary', 'REMAINING', { levels: 3 });
  await clipCard(p, 'client-package', 'ACTIVE PACKAGE', { levels: 2 });
  await p.close();

  p = await open(`/dashboard/clients/${james.id}`, DESK, clientTab('Billing'));
  await clipCard(p, 'billing-totals', 'TOTAL PAID', { levels: 3 });
  await p.close();

  // The body-metrics chart, from the client's own Progress tab.
  p = await open(`/dashboard/clients/${james.id}`, { ...DESK, height: 1400 }, clientTab('Progress'));
  await clipCard(p, 'progress-weight', 'First', { levels: 3 });
  await p.close();

  await browser.close();
  console.log('\nCrops in', OUT);
})();
