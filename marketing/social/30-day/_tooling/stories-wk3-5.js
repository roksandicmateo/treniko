// TRENIKO — Stories for weeks 3-5, plus the FOR TRAINERS highlight seeds.
//
// Session 4. The 18 Aug - 14 Sep calendar had Stories for weeks 1-2 only, so
// every feed post from 31 Aug onwards was going out with no Story support at
// all. These fill that gap and no more — the cadence rule in
// STORY_PUBLISH_QUEUE.md is two to four Story sequences a week, not one a day.
//
// Style, canvas and helpers are the existing ones (vertical.js): 1080 x 1920,
// text clear of the bottom 250 px, wordmark top-left, #0ea5e9.
//
// English only, per STRATEGY.md and the session-4 decision to keep the account
// single-language.
//
// Run from the repository root:  node marketing/social/30-day/_tooling/stories-wk3-5.js

const {vpage, vpoll, mk, C, render} = require('./vertical.js');

const S = 'marketing/social/30-day/stories';
const POLL_NOTE = 'Poll sticker — add in the Instagram app.';
const ASK_NOTE  = 'Question sticker — add in the Instagram app.';

let d;

// ── WEEK 3 (31 Aug - 5 Sep) ──────────────────────────────────────────────────
d = mk(`${S}/week-3`);

// S8 — Mon 31 Aug, after P11 (what happens after a client books).
render(vpoll({
  question: ['How do you', 'confirm tomorrow’s', 'session?'],
  opts: ['A message', 'Calendar invite', 'They just know'],
  note: POLL_NOTE,
}), `${d}/story-5-poll.png`);

// S9 — Wed 2 Sep. Research: feeds the FAQ highlight and the next content cycle.
render(vpage({
  lines: ['Which admin job', 'would you hand', 'over tomorrow?'],
  size: 82,
  support: ['Answer in the question box.', 'We read every one.'],
  bg: C.tint,
}), `${d}/story-6-question.png`);

// S10 — Sat 5 Sep, after P15. Lead-in card, then reshare the post itself.
render(vpage({
  lines: ['New on the', 'feed today.'],
  size: 96,
  support: ['Tap through to the post.'],
  cta: 'treniko.com',
}), `${d}/story-7-reshare.png`);

// ── WEEK 4 (7 - 12 Sep) ──────────────────────────────────────────────────────
d = mk(`${S}/week-4`);

// S11 — Tue 8 Sep, after P17 (payment tracking).
render(vpoll({
  question: ['How do you know', 'who has paid?'],
  opts: ['A spreadsheet', 'The bank app', 'Memory'],
  note: POLL_NOTE,
}), `${d}/story-8-poll.png`);

// S12 — Thu 10 Sep, alongside the P18 Reel.
render(vpage({
  lines: ['New Reel', 'today.'],
  size: 96,
  support: ['Tap through to watch.'],
  cta: 'treniko.com',
}), `${d}/story-9-reshare.png`);

// S13 — Fri 11 Sep, after P19 (what feature would save you the most time).
render(vpage({
  lines: ['What would you', 'automate first?'],
  size: 84,
  support: ['Answer in the question box.', 'It goes straight on the list.'],
  bg: C.tint,
}), `${d}/story-10-question.png`);

// ── WEEK 5 (14 Sep) ──────────────────────────────────────────────────────────
d = mk(`${S}/week-5`);

// S14 — Mon 14 Sep, after the P21 Reel. Closes the 30-day window.
render(vpage({
  lines: ['Four weeks of', 'this account,', 'in one place.'],
  size: 80,
  support: ['Everything is in the highlights.'],
  cta: 'treniko.com',
  bg: C.ink,
  ink: '#ffffff',
  // vpage defaults support text to C.body (#4b5563), which is near-invisible on
  // the ink ground. Slate-300 keeps it legible on a phone in daylight.
  body: '#cbd5e1',
}), `${d}/story-11-recap.png`);

// ── FOR TRAINERS highlight seeds ─────────────────────────────────────────────
// HIGHLIGHT_PLAN.md lists FOR TRAINERS as "Not written. Needs 3 Stories: who it
// is for, who it is *not* for, what the first week looks like." These are those
// three, in that order.
d = mk(`${S}/highlights-trainers`);

render(vpage({
  label: 'FOR TRAINERS',
  lines: ['If you run the', 'coaching business', 'on your own.'],
  size: 78,
  support: ['Independent and hybrid PTs.', 'Your clients, your schedule, your money.'],
}), `${d}/story-1-for.png`);

// Saying who it is not for is the reason this highlight is worth having. A page
// that claims to suit everyone reads as a page that suits no one.
render(vpage({
  label: 'FOR TRAINERS',
  lines: ['Not for everyone.'],
  size: 88,
  support: ['If a notebook still works for you,', 'you do not need this yet.'],
  bg: C.tint,
}), `${d}/story-2-not-for.png`);

render(vpage({
  label: 'FOR TRAINERS',
  lines: ['Your first week.'],
  size: 88,
  support: ['Add your clients.', 'Book the week.', 'Log one payment.'],
  cta: 'treniko.com',
  bg: C.ink,
  ink: '#ffffff',
  body: '#cbd5e1',
}), `${d}/story-3-first-week.png`);

// ── Correction to an existing, unposted asset ────────────────────────────────
// week-2/story-4-reshare.png read "Swipe up to the post." Instagram removed the
// swipe-up gesture in 2021 and replaced it with link stickers, so that line told
// the viewer to do something the app no longer supports. The card had not been
// posted, so it is corrected here rather than left to go out wrong.
d = mk(`${S}/week-2`);
render(vpage({
  lines: ['New on the', 'feed today.'],
  size: 96,
  support: ['Tap through to the post.'],
  cta: 'treniko.com',
}), `${d}/story-4-reshare.png`);

console.log('stories weeks 3-5, FOR TRAINERS seeds, and the week-2 reshare fix rendered');
