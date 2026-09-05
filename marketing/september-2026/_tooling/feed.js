// TRENIKO — September 2026 feed assets (15–30 Sep).
//
// Eight Instagram feed pieces, each also exported at Facebook's 1200 × 1500.
// Cycle 1 already covers 5–14 Sep and is scheduled inside Instagram; nothing
// here touches those dates.
//
//   NODE_PATH=<scratchpad>/node_modules node marketing/september-2026/_tooling/feed.js
//
const S = require('./september.js');
const { C, mk, render, productFeed, heroFeed, facebook,
        compose, hookBody, stackBody, numberBody, scatterBody, titled, statement } = S;
const fs = require('fs');
const path = require('path');

const ROOT = 'marketing/september-2026/feed';
const FB = 'marketing/september-2026/feed/_facebook';

const hook = (o) => compose(hookBody(o), { bg: o.bg || C.white, cta: o.cta || '', accent: o.accent || C.blue });
const stack = (o) => compose(stackBody(o), { bg: o.bg || C.white, cta: o.cta || '' });
const num = (o) => compose(numberBody(o), { bg: o.bg || C.white });

(async () => {
  mk(FB);

  // ── F01 · Tue 15 Sep · 11:30 · Carousel ×4 · Pillar A — the problem ────────
  let d = mk(`${ROOT}/2026-09-15-problem-six-places`);
  render(hook({ lines: ['21:40.', '"Any chance we', 'can move', 'tomorrow?"'], size: 88, bg: C.tint }), `${d}/slide-1.png`);
  render(stack({ title: ['So you open:'], items: ['The calendar', 'The chat thread', 'The spreadsheet', 'The note to yourself'],
    support: 'One message. Twenty minutes.' }), `${d}/slide-2.png`);
  render(hook({ lines: ['Your coaching', 'business is not', 'disorganised.'], size: 84,
    support: ['It is spread across six places, and', 'none of them talk to each other.'] }), `${d}/slide-3.png`);
  render(statement({ lines: ['Clients. Sessions.', 'Packages. Payments.', 'One place.'], size: 76,
    support: ['Built for trainers who would rather', 'coach than reconcile a spreadsheet.'], cta: 'treniko.com' }), `${d}/slide-4.png`);

  // ── F02 · Thu 17 Sep · 18:30 · Carousel ×3 · Pillar C — product demo ───────
  d = mk(`${ROOT}/2026-09-17-needs-your-attention`);
  render(hook({ lines: ['What needs you', 'today?'], size: 92,
    support: ['Most trainers answer that by opening', 'four apps and hoping.'], bg: C.tint }), `${d}/slide-1.png`);
  await productFeed({ out: `${d}/slide-2.png`, crop: 'phone-attention', cropWidth: 680,
    lines: ['TRENIKO answers it', 'on the first screen.'], size: 64,
    support: ['One payment still outstanding.', 'One package about to run out.'] });
  await productFeed({ out: `${d}/slide-3.png`, crop: 'phone-today', cropWidth: 860,
    lines: ['And who is', 'training today.'], size: 66, cta: 'treniko.com' });

  // ── F03 · Sat 19 Sep · 11:30 · Carousel ×5 · Pillar D — education ──────────
  d = mk(`${ROOT}/2026-09-19-ten-to-twenty-five-clients`);
  render(hook({ lines: ['What breaks when', 'you go from 10', 'clients to 25.'], size: 78 }), `${d}/slide-1.png`);
  render(num({ n: 1, lines: ['Remaining sessions', 'stop adding up', 'in your head.'] }), `${d}/slide-2.png`);
  render(num({ n: 2, lines: ['You start checking', 'the bank app to', 'see who has paid.'], bg: C.tint }), `${d}/slide-3.png`);
  render(num({ n: 3, lines: ['A client goes quiet', 'for three weeks', 'before you notice.'] }), `${d}/slide-4.png`);
  render(statement({ lines: ['Nothing is wrong', 'with your', 'spreadsheet.', 'You outgrew it.'], size: 74,
    support: ['Clients, sessions, packages and payments,', 'in one place instead of six.'], cta: 'treniko.com' }), `${d}/slide-5.png`);

  // ── F04 · Tue 22 Sep · 19:00 · Carousel ×5 · Pillar B — the workflow ───────
  d = mk(`${ROOT}/2026-09-22-client-session-package-payment`);
  render(hook({ lines: ['Client.', 'Session.', 'Package.', 'Payment.'], size: 96,
    support: ['Four things every coaching business runs on.', 'Four places most trainers keep them.'], bg: C.tint }), `${d}/slide-1.png`);
  await productFeed({ out: `${d}/slide-2.png`, crop: 'phone-clients', cropWidth: 540, cropTop: 0.36, keep: 0.62,
    lines: ['Every client, and', 'what is left.'], size: 66,
    support: ['Sessions remaining, in the list itself.'] });
  await productFeed({ out: `${d}/slide-3.png`, crop: 'calendar-week', cropWidth: 900, keep: 0.25, keepX: 0.46,
    lines: ['The week, as it', 'actually is.'], size: 66,
    support: ['Book into an empty slot. It is the same', 'record the client page reads from.'] });
  await productFeed({ out: `${d}/slide-4.png`, crop: 'phone-package', cropWidth: 640,
    lines: ['Sessions counted', 'by the app,', 'not by you.'], size: 62 });
  await productFeed({ out: `${d}/slide-5.png`, crop: 'phone-billing', cropWidth: 700,
    lines: ['And what has', 'actually been paid.'], size: 64, cta: 'treniko.com' });

  // ── F05 · Thu 24 Sep · 18:00 · Carousel ×4 · Pillar D — education ──────────
  d = mk(`${ROOT}/2026-09-24-follow-up-without-nagging`);
  render(hook({ lines: ['How to follow up', 'without feeling', 'like a nag.'], size: 82 }), `${d}/slide-1.png`);
  render(hook({ lines: ['Tie it to', 'something', 'they said.'], size: 84, bg: C.tint,
    support: ['"You said Thursdays are hard —" beats', '"just checking in".'] }), `${d}/slide-2.png`);
  render(hook({ lines: ['A fixed rhythm', 'beats a random', 'poke.'], size: 84,
    support: ['Every second Monday is a system.', 'Whenever-you-remember is nagging.'] }), `${d}/slide-3.png`);
  render(statement({ lines: ['Ask one question', 'they can answer', 'in one line.'], size: 78,
    support: ['Three questions gets you no answer at all.'], cta: 'What do you send? Tell us below.' }), `${d}/slide-4.png`);

  // ── F06 · Sat 26 Sep · 11:30 · Carousel ×3 · Pillar C — product demo ───────
  d = mk(`${ROOT}/2026-09-26-how-many-sessions-left`);
  render(hook({ lines: ['"How many', 'sessions do I', 'have left?"'], size: 92, bg: C.tint,
    support: ['Ten seconds. Go.'] }), `${d}/slide-1.png`);
  await productFeed({ out: `${d}/slide-2.png`, crop: 'phone-client-summary', cropWidth: 900,
    lines: ['It is on the client’s', 'own page.'], size: 66,
    support: ['Remaining, next session, and whether', 'the pack has been paid for.'] });
  await productFeed({ out: `${d}/slide-3.png`, crop: 'phone-package', cropWidth: 640,
    lines: ['Counted down as', 'sessions happen.'], size: 64, cta: 'treniko.com' });

  // ── F07 · Mon 28 Sep · 11:00 · Single · Pillar A — the problem ─────────────
  d = mk(`${ROOT}/2026-09-28-client-about-to-leave`);
  render(hook({ lines: ['You can name', 'your best client.', 'Can you name the', 'one about to leave?'], size: 74,
    support: ['Clients rarely quit. They just stop booking.'], cta: 'How do you catch it?' }), `${d}/slide-1.png`);

  // ── F08 · Wed 30 Sep · 19:00 · Carousel ×2 · Pillar E — brand ──────────────
  d = mk(`${ROOT}/2026-09-30-run-your-business`);
  render(statement({ lines: ['Run your coaching', 'business.', 'Not your', 'spreadsheets.'], size: 82,
    bg: C.ink, support: [] }), `${d}/slide-1.png`);
  render(hook({ lines: ['Less admin.', 'More coaching.'], size: 96,
    support: ['TRENIKO is in beta and free to try.', 'If you train clients for a living,', 'we would like your opinion of it.'], cta: 'treniko.com' }), `${d}/slide-2.png`);

  // ── Facebook exports — same design, platform ratio ─────────────────────────
  const posts = fs.readdirSync(ROOT).filter((n) => !n.startsWith('_'));
  for (const post of posts) {
    const outDir = mk(path.join(FB, post));
    for (const f of fs.readdirSync(path.join(ROOT, post)).filter((f) => f.endsWith('.png'))) {
      await facebook(path.join(ROOT, post, f), path.join(outDir, f));
    }
  }

  const count = posts.reduce((n, p) => n + fs.readdirSync(path.join(ROOT, p)).length, 0);
  console.log(`feed: ${posts.length} posts, ${count} slides, ${count} Facebook exports`);
})().catch((e) => { console.error(e.message); process.exit(1); });
