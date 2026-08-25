// TRENIKO — daily cadence, batch 1 (D01–D16), 20–26 Aug 2026.
//
// Context: the brief asks for two feed posts a day across 19 Aug – 19 Sep on
// both platforms. STRATEGY.md and FACEBOOK_STRATEGY.md both specify a far lower
// cadence (2–3 a week on Facebook, "do not post daily to a Page with 0
// followers"), and 14 Instagram posts, 5 Reels and 7 Facebook posts are already
// booked in this window. These fill the gaps around those without touching them.
//
// Every claim below is a capability that exists in the product — checked against
// backend/routes, backend/migrations and src/pages. No invented features, no
// statistics, no testimonials, no customer counts.
//
// Run from the repository root:
//   node marketing/social/30-day/_tooling/daily-b1.js

const { compose, hookBody, stackBody, numberBody, scatterBody, titled, statement, B } = require('./tpl.js');
const { C, render } = B;
const fs = require('fs');

const R = 'marketing/social/30-day/posts';
const mk = (p) => { fs.mkdirSync(p, { recursive: true }); return p; };

const hook = (o) => compose(hookBody(o), { bg: o.bg || C.white, cta: o.cta || '', accent: o.accent || C.blue });
const stack = (o) => compose(stackBody(o), { bg: o.bg || C.white, cta: o.cta || '' });
const num = (o) => compose(numberBody(o), { bg: o.bg || C.white });
const said = (o) => compose(statement(o), { bg: o.bg || C.ink });

const jobs = [];
const post = (id, slides) => jobs.push({ id, slides });

/* ───────────────────────── D01 · Thu 20 Aug · 11:30 · Pain ──────────────── */
post('daily-01', [
  () => hook({ lines: ['How long does it', 'take you to answer', '“have I been paid?”'], size: 78 }),
  () => stack({ title: ['Right now.'], items: ['Open the bank app', 'Scroll for the name', 'Cross-check the sessions', 'Decide you are probably right'],
    support: 'Probably is not an answer.' }),
  () => hook({ lines: ['In TRENIKO it is', 'on the client.'], size: 84,
    support: ['Amount, method and status, next to', 'the sessions it paid for.'], cta: 'treniko.com' }),
]);

/* ───────────────────────── D02 · Thu 20 Aug · 20:00 · Product ───────────── */
post('daily-02', [
  () => hook({ lines: ['Your packages', 'should count', 'themselves.'], size: 84, bg: C.tint }),
  () => stack({ title: ['What happens', 'after a session.'], items: ['You mark it completed', 'The package counts down', 'The client page updates', 'You do nothing else'],
    support: 'One action, not four.', cta: 'treniko.com' }),
]);

/* ───────────────────────── D03 · Fri 21 Aug · 08:30 · Relatable ─────────── */
post('daily-03', [
  () => hook({ lines: ['The 6am client', 'cancels at 5:40.'], size: 86 }),
  () => hook({ lines: ['Mark it cancelled', 'and move on.'], size: 82,
    support: ['Completed, cancelled or no-show.', 'Your history stays honest without', 'a spreadsheet note you will forget.'], cta: 'treniko.com', bg: C.tint }),
]);

/* ───────────────────────── D04 · Fri 21 Aug · 19:30 · Practical ─────────── */
post('daily-04', [
  () => hook({ lines: ['4 things to check', 'before Monday.'], size: 82 }),
  () => num({ n: 1, lines: ['Who is booked', 'this week.'] }),
  () => num({ n: 2, lines: ['Whose package', 'is nearly out.'], bg: C.tint }),
  () => num({ n: 3, lines: ['Who still owes', 'you money.'] }),
  () => num({ n: 4, lines: ['Who you have not', 'seen in a while.'], bg: C.tint }),
  () => hook({ lines: ['All four are on', 'one screen.'], size: 84, cta: 'treniko.com' }),
]);

/* ───────────────────────── D05 · Sat 22 Aug · 10:00 · Pain ──────────────── */
post('daily-05', [
  () => hook({ lines: ['Nobody starts a', 'coaching business', 'to do admin.'], size: 80 }),
  () => stack({ title: ['And yet.'], items: ['Rewriting the same session', 'Counting the same package', 'Chasing the same payment', 'Rebuilding the same plan'],
    support: 'Every one of these is a solved problem.', cta: 'treniko.com' }),
]);

/* ───────────────────────── D06 · Sun 23 Aug · 11:00 · Product ───────────── */
post('daily-06', [
  () => hook({ lines: ['One client.', 'One record.'], size: 92, bg: C.tint }),
  () => stack({ title: ['What sits on it.'], items: ['Their goals and notes', 'Every session, with its outcome', 'Their package and what is left', 'What they have paid'],
    support: 'Open it and the whole history is there.', cta: 'treniko.com' }),
]);

/* ───────────────────────── D07 · Sun 23 Aug · 18:30 · Relatable ─────────── */
post('daily-07', [
  () => said({ lines: ['You are not', 'disorganised.', 'Your tools are.'], size: 82,
    support: ['Five apps that do not talk to each other', 'is not a personal failing.'], cta: 'treniko.com' }),
]);

/* ───────────────────────── D08 · Mon 24 Aug · 08:00 · Practical ─────────── */
post('daily-08', [
  () => hook({ lines: ['A session log is', 'worth more than', 'a session memory.'], size: 76 }),
  () => stack({ title: ['Record three things.'], items: ['What you actually did', 'What changed since last time', 'What to do next week'],
    support: 'Ten seconds now saves the whole check-in later.', cta: 'treniko.com' }),
]);

/* ───────────────────────── D09 · Mon 24 Aug · 19:30 · Pain ──────────────── */
post('daily-09', [
  () => hook({ lines: ['“How many', 'sessions have', 'I got left?”'], size: 84, bg: C.tint }),
  () => hook({ lines: ['The worst answer', 'is “let me check”.'], size: 80,
    support: ['Packages count down as sessions are', 'completed, so the number is already', 'correct when they ask.'], cta: 'treniko.com' }),
]);

/* ───────────────────────── D10 · Tue 25 Aug · 11:00 · Product ───────────── */
post('daily-10', [
  () => hook({ lines: ['Group sessions', 'without a second', 'system.'], size: 80 }),
  () => stack({ title: ['Same calendar.'], items: ['Book the group once', 'Keep its own roster', 'Mark attendance per client', 'It lands on their record'],
    support: 'One-to-one and groups side by side.', cta: 'treniko.com' }),
]);

/* ───────────────────────── D11 · Tue 25 Aug · 20:00 · Conversation ──────── */
post('daily-11', [
  () => hook({ lines: ['What takes you', 'longest every week', 'that is not coaching?'], size: 74, bg: C.tint,
    support: ['Genuinely asking. Tell us below —', 'it goes on the list.'] }),
]);

/* ───────────────────────── D12 · Wed 26 Aug · 08:30 · Practical ─────────── */
post('daily-12', [
  () => hook({ lines: ['Write the plan', 'once. Reuse it', 'forever.'], size: 82 }),
  () => stack({ title: ['How templates help.'], items: ['Build it from your exercise library', 'Save it as a template', 'Attach it to the next client', 'Adjust instead of starting over'],
    support: 'The library gets more useful the longer you use it.', cta: 'treniko.com' }),
]);

/* ───────────────────────── D13 · Wed 26 Aug · 19:00 · Pain ──────────────── */
post('daily-13', [
  () => hook({ lines: ['The client who', 'quietly ran out', 'of sessions.'], size: 82 }),
  () => hook({ lines: ['You found out', 'after the session.'], size: 84, bg: C.tint,
    support: ['TRENIKO tells you at two sessions left,', 'not at zero.'], cta: 'treniko.com' }),
]);

/* ───────────────────────── D14 · Thu 27 Aug · 08:00 · Product ───────────── */
post('daily-14', [
  () => hook({ lines: ['Progress you can', 'actually look up.'], size: 84 }),
  () => stack({ title: ['At the check-in.'], items: ['Open the client', 'Read what changed', 'Compare it to last time', 'Plan the next block'],
    support: 'Start from the record, not from memory.', cta: 'treniko.com' }),
]);

/* ───────────────────────── D15 · Thu 27 Aug · 19:30 · Relatable ─────────── */
post('daily-15', [
  () => hook({ lines: ['Eight tabs open,', 'and you still', 'cannot answer', 'one question.'], size: 76, bg: C.tint }),
  () => hook({ lines: ['Not eight tabs.', 'One.'], size: 96, cta: 'treniko.com' }),
]);

/* ───────────────────────── D16 · Fri 28 Aug · 08:30 · Practical ─────────── */
post('daily-16', [
  () => hook({ lines: ['Archive, do not', 'delete.'], size: 90 }),
  () => hook({ lines: ['Clients come back.', 'Their history', 'should still exist.'], size: 78,
    support: ['Archiving keeps the record and frees', 'the slot on your plan.'], cta: 'treniko.com' }),
]);

/* ─────────────────────────────── render ─────────────────────────────────── */

(async () => {
  let files = 0;
  for (const job of jobs) {
    const dir = mk(`${R}/${job.id}`);
    for (let i = 0; i < job.slides.length; i++) {
      await render(job.slides[i](), `${dir}/slide-${i + 1}.png`);
      files++;
    }
  }
  console.log(`rendered ${files} slides across ${jobs.length} posts`);
})();
