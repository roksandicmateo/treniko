// TRENIKO — September 2026 Instagram Story assets (15–30 Sep).
//
// Ten sequences, two or three frames each, 1080 × 1920.
//
// Where a sequence uses a poll, a question box or a slider, the frame carries
// the question as type and leaves the sticker's space empty: the sticker is
// added in the Instagram app at publish time, because a drawn poll cannot be
// voted on and the answers are the entire point of those Stories.
//
//   NODE_PATH=<scratchpad>/node_modules node marketing/september-2026/_tooling/stories.js
//
const S = require('./september.js');
const { C, mk, storyFrame, storyPoll, storyProduct } = S;
const fs = require('fs');

const ROOT = 'marketing/september-2026/stories';

(async () => {
  // ── S01 · Tue 15 Sep, after 11:30 · Poll · research ────────────────────────
  let d = mk(`${ROOT}/2026-09-15-where-do-you-track`);
  storyPoll({ out: `${d}/frame-1.png`,
    question: ['Where do you', 'track remaining', 'sessions?'],
    options: ['A spreadsheet', 'Notes app', 'The calendar', 'I just remember'],
    note: 'Poll sticker goes in the empty slots.' });
  storyFrame({ out: `${d}/frame-2.png`,
    lines: ['Whichever you', 'picked, you check', 'it more than once.'], size: 76,
    support: ['That is the part TRENIKO removes.'], footer: 'Link in bio' });

  // ── S02 · Wed 16 Sep, evening · Reshare of the 15 Sep post ─────────────────
  d = mk(`${ROOT}/2026-09-16-six-places-reshare`);
  storyFrame({ out: `${d}/frame-1.png`,
    lines: ['One message.', 'Four apps.', 'Twenty minutes.'], size: 84,
    support: ['New post — the 21:40 reschedule.'], footer: 'Tap to read' });
  await storyProduct({ out: `${d}/frame-2.png`, crop: 'phone-attention', cropWidth: 860,
    lines: ['Or one screen.'], size: 84, footer: 'treniko.com' });

  // ── S03 · Fri 18 Sep, midday · Question box · research ─────────────────────
  d = mk(`${ROOT}/2026-09-18-hand-over-tomorrow`);
  storyPoll({ out: `${d}/frame-1.png`,
    question: ['Which admin job', 'would you hand', 'over tomorrow?'],
    options: [''], note: 'Question sticker goes in the empty slot.', bg: C.white });
  storyFrame({ out: `${d}/frame-2.png`,
    lines: ['We read every', 'answer.'], size: 88,
    support: ['It is what decides what gets built next.'], footer: 'treniko.com' });

  // ── S04 · Sat 19 Sep, midday · This-or-that ────────────────────────────────
  d = mk(`${ROOT}/2026-09-19-spreadsheet-or-memory`);
  storyPoll({ out: `${d}/frame-1.png`,
    question: ['How do you know', 'who has paid?'],
    options: ['The bank app', 'A spreadsheet', 'Memory'],
    note: 'Poll sticker goes in the empty slots.' });
  await storyProduct({ out: `${d}/frame-2.png`, crop: 'phone-billing', cropWidth: 820,
    lines: ['Or the client’s', 'own page.'], size: 76, footer: 'treniko.com' });

  // ── S05 · Mon 21 Sep, evening · Product ────────────────────────────────────
  d = mk(`${ROOT}/2026-09-21-two-sessions-left`);
  storyFrame({ out: `${d}/frame-1.png`,
    lines: ['Who is about to', 'run out of', 'sessions?'], size: 82,
    support: ['If the answer takes more than ten seconds,', 'it is being tracked in the wrong place.'] });
  await storyProduct({ out: `${d}/frame-2.png`, crop: 'phone-package', cropWidth: 820,
    lines: ['Counted for you.'], size: 84, footer: 'treniko.com' });

  // ── S06 · Tue 22 Sep, evening · Three-frame workflow ───────────────────────
  d = mk(`${ROOT}/2026-09-22-workflow-sequence`);
  storyFrame({ out: `${d}/frame-1.png`,
    lines: ['Client.', 'Session.', 'Package.', 'Payment.'], size: 96,
    support: ['Four things. Four apps. Usually.'], bg: C.tint });
  await storyProduct({ out: `${d}/frame-2.png`, crop: 'phone-clients', cropWidth: 620,
    cropTop: 0.36, keep: 0.62, lines: ['One list.'], size: 88 });
  await storyProduct({ out: `${d}/frame-3.png`, crop: 'phone-billing', cropWidth: 820,
    lines: ['One answer', 'about money.'], size: 80, footer: 'treniko.com' });

  // ── S07 · Thu 24 Sep, evening · Slider · research ──────────────────────────
  d = mk(`${ROOT}/2026-09-24-chasing-a-payment`);
  storyPoll({ out: `${d}/frame-1.png`,
    question: ['How comfortable', 'are you chasing', 'a late payment?'],
    options: [''], note: 'Emoji slider goes in the empty slot.', bg: C.white });
  storyFrame({ out: `${d}/frame-2.png`,
    lines: ['Nobody enjoys it.', 'Knowing sooner', 'helps.'], size: 78,
    support: ['Unpaid shows on the first screen, with', 'how long it has been waiting.'], footer: 'treniko.com' });

  // ── S08 · Sat 26 Sep, midday · Poll · research ─────────────────────────────
  d = mk(`${ROOT}/2026-09-26-how-many-clients`);
  storyPoll({ out: `${d}/frame-1.png`,
    question: ['How many active', 'clients are you', 'carrying?'],
    options: ['Under 10', '10 – 25', '25 – 40', 'More than 40'],
    note: 'Poll sticker goes in the empty slots.' });
  storyFrame({ out: `${d}/frame-2.png`,
    lines: ['Somewhere around', '25, the spreadsheet', 'stops helping.'], size: 72,
    support: ['Or 15. Or 40. Every trainer has a number.'], footer: 'Tell us yours' });

  // ── S09 · Mon 28 Sep, midday · Question box · research ─────────────────────
  d = mk(`${ROOT}/2026-09-28-client-going-quiet`);
  storyFrame({ out: `${d}/frame-1.png`,
    lines: ['Clients rarely', 'quit. They just', 'stop booking.'], size: 80,
    support: ['Three weeks pass before anyone notices.'], bg: C.tint });
  storyPoll({ out: `${d}/frame-2.png`,
    question: ['How do you spot', 'a client going', 'quiet?'],
    options: [''], note: 'Question sticker goes in the empty slot.', bg: C.white });

  // ── S10 · Wed 30 Sep, evening · Recap + link ───────────────────────────────
  d = mk(`${ROOT}/2026-09-30-month-recap`);
  storyFrame({ out: `${d}/frame-1.png`,
    lines: ['Run your', 'coaching', 'business.', 'Not your', 'spreadsheets.'], size: 92,
    bg: C.ink, ink: C.white, accent: C.blueLt });
  storyFrame({ out: `${d}/frame-2.png`,
    lines: ['TRENIKO is in', 'beta, and free', 'to try.'], size: 86,
    support: ['If you train clients for a living, we would', 'like your opinion of it.'], footer: 'treniko.com' });

  const seqs = fs.readdirSync(ROOT).filter((n) => !n.startsWith('_'));
  const frames = seqs.reduce((n, s) => n + fs.readdirSync(`${ROOT}/${s}`).length, 0);
  console.log(`stories: ${seqs.length} sequences, ${frames} frames`);
})().catch((e) => { console.error(e.message); process.exit(1); });
