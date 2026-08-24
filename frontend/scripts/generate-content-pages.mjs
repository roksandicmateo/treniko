/**
 * Generates the static content pages under frontend/public/.
 *
 * ── Why these pages exist ────────────────────────────────────────────────────
 * treniko.com has three indexable URLs and none of them targets anything a
 * personal trainer would actually type into Google. These do.
 *
 * ── Why they are static HTML and not React routes ────────────────────────────
 * The application is a client-side SPA — the HTML it serves is an empty
 * <div id="root">. Google executes JavaScript, but on a second pass with a
 * rendering budget a brand-new domain does not command, and most other crawlers
 * do not execute it at all. Pages whose whole job is to be read by a search
 * engine must not depend on a render that may never happen.
 *
 * nginx already resolves these without any config change: `try_files $uri
 * $uri/ /index.html` finds `/guides/client-management/index.html` on disk and
 * serves it before the SPA fallback is reached. No route, no bundle, no risk to
 * the product.
 *
 * ── Why a generator rather than five hand-written files ──────────────────────
 * The header, footer, breadcrumb, analytics beacon and metadata block are
 * identical across every page. Maintained by hand in five places they drift,
 * and the first thing to drift silently is a canonical URL. Run:
 *
 *     node scripts/generate-content-pages.mjs
 *
 * The output is committed, so nothing at build or deploy time depends on this
 * script having been run.
 *
 * ── Rules the copy follows ───────────────────────────────────────────────────
 * 1. Useful without registering. Every page has to be worth reading even by a
 *    trainer who never signs up, or it is a doorway page with better manners.
 * 2. No invented statistics, customers, testimonials or ratings. TRENIKO has
 *    almost no users; saying otherwise in content or in structured data is
 *    both a lie and a manual action from Google.
 * 3. Say when TRENIKO is the wrong answer. A page that admits a notebook is
 *    fine for four clients is more credible, and it filters the traffic to
 *    people the product can actually help.
 * 4. English only, matching the standing single-language decision for public
 *    TRENIKO copy.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');
const ORIGIN = 'https://treniko.com';

/* ── Shared chrome ─────────────────────────────────────────────────────────── */

const LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><rect width="100" height="100" rx="22" fill="#0ea5e9"/><rect x="19" y="28" width="62" height="16" rx="3.2" fill="#fff"/><rect x="42" y="28" width="16" height="48" rx="3.2" fill="#fff"/></svg>`;

const header = () => `  <header class="site">
    <div class="wrap-wide bar">
      <a class="brand" href="/">${LOGO}TRENIKO</a>
      <nav>
        <a href="/personal-trainer-software">Software</a>
        <a href="/guides">Guides</a>
        <a href="/">Product</a>
      </nav>
    </div>
  </header>`;

const footer = () => `  <footer class="site">
    <div class="wrap">
      <div class="links">
        <a href="/">TRENIKO</a>
        <a href="/personal-trainer-software">Personal trainer software</a>
        <a href="/guides">Guides</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </div>
      <p style="margin:0">Training management software for independent personal trainers.
        Free while TRENIKO is early — there is no payment processor in the product,
        so there is nothing to pay and no card to enter.</p>
    </div>
  </footer>`;

/**
 * The page-view beacon, and the UTM hand-off.
 *
 * Two jobs, both small enough to inline rather than ship a file:
 *
 * 1. **Count the view.** Same contract as the React beacon in
 *    src/utils/pageView.js: no cookie, no storage, no identifier, fire and
 *    forget, and a failure is invisible. Without this, traffic to these pages
 *    would be the one part of the funnel nobody could see.
 *
 * 2. **Carry the campaign across.** Someone arriving from Reddit lands on a
 *    guide, not on `/`, so the React attribution capture — which only runs
 *    inside the app — never sees the UTM tags and the signup is recorded as
 *    direct. Any incoming utm_* parameters are therefore appended to the links
 *    that lead into the app, so the existing first-touch capture picks them up
 *    unchanged. Nothing is invented: if there are no tags on the way in, none
 *    are added on the way out.
 */
const beacon = () => `  <script>
  (function () {
    try {
      var p = location.pathname.replace(/\\/$/, '') || '/';
      var q = new URLSearchParams(location.search);
      var body = { path: p };
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
        var v = q.get(k);
        if (v) body[k] = String(v).trim().slice(0, 255);
      });
      if (document.referrer) {
        try {
          var u = new URL(document.referrer);
          if (u.host && u.host !== location.host) body.referrer_host = u.host.slice(0, 255);
        } catch (e) { /* unparseable referrer is simply not recorded */ }
      }
      var payload = JSON.stringify(body);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/metrics/view', new Blob([payload], { type: 'application/json' }));
      }

      // Hand any incoming campaign tags to the app, so first-touch attribution
      // survives a landing that was not the landing page.
      var carry = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .filter(function (k) { return q.get(k); })
        .map(function (k) { return k + '=' + encodeURIComponent(q.get(k)); })
        .join('&');
      if (carry) {
        document.querySelectorAll('a[href="/"], a[href="/register"]').forEach(function (a) {
          a.setAttribute('href', a.getAttribute('href') + '?' + carry);
        });
      }
    } catch (e) { /* a counter must never break the page it counts */ }
  })();
  </script>`;

/**
 * Build one page.
 *
 * `jsonld` is passed through verbatim, so every schema block is written
 * deliberately next to the content it describes rather than assembled from
 * guesswork here. Nothing may claim a rating, a review or a price.
 */
function page({ path, title, description, crumbs, jsonld, body }) {
  const url = `${ORIGIN}${path}`;
  const crumbHtml = crumbs
    .map((c, i) =>
      i === crumbs.length - 1
        ? `<span>${c.name}</span>`
        : `<a href="${c.path}">${c.name}</a> <span aria-hidden="true">›</span>`
    )
    .join(' ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate icon" type="image/png" sizes="96x96" href="/favicon-96.png">
<meta name="theme-color" content="#0ea5e9">

<meta property="og:site_name" content="TRENIKO">
<meta property="og:type" content="article">
<meta property="og:locale" content="en_GB">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${ORIGIN}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${ORIGIN}/og-image.png">

<link rel="stylesheet" href="/assets-static/content.css">
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>
</head>
<body>
${header()}
  <div class="wrap crumbs">${crumbHtml}</div>
  <main class="wrap">
${body}
  </main>
${footer()}
${beacon()}
</body>
</html>
`;
}

/** Breadcrumb schema, built from the same array that renders the visible trail
 *  — so the markup can never describe a path the reader does not see. */
const breadcrumb = (crumbs) => ({
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: `${ORIGIN}${c.path}`,
  })),
});

const ORG = {
  '@type': 'Organization',
  '@id': `${ORIGIN}/#organization`,
  name: 'TRENIKO',
  url: `${ORIGIN}/`,
};

const cta = (text) => `    <div class="note">
      <span class="label">TRENIKO</span>
      <p>${text}</p>
      <div class="cta-row">
        <a class="btn" href="/register">Start for free</a>
        <a class="btn btn-ghost" href="/">See what TRENIKO does</a>
      </div>
      <p style="margin-top:12px;font-size:14px;color:#6b7280">Free plan: up to 5 clients and
        20 sessions a month. No credit card — there is no payment processor in the product.</p>
    </div>`;

/* ── Pages ─────────────────────────────────────────────────────────────────── */

const PAGES = [];

/* 1 ── /personal-trainer-software ─────────────────────────────────────────── */
{
  const path = '/personal-trainer-software';
  const crumbs = [{ name: 'TRENIKO', path: '/' }, { name: 'Personal trainer software', path }];
  const title = 'Personal Trainer Software: What It Does and What to Look For | TRENIKO';
  const description =
    'What personal trainer software actually does, the six things worth checking before you pick one, and when a spreadsheet is still the right answer.';

  PAGES.push({
    path,
    title,
    description,
    crumbs,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumb(crumbs),
        ORG,
        {
          '@type': 'WebPage',
          '@id': `${ORIGIN}${path}#webpage`,
          url: `${ORIGIN}${path}`,
          name: title,
          description,
          isPartOf: { '@id': `${ORIGIN}/#website` },
          about: { '@id': `${ORIGIN}/#software` },
          inLanguage: 'en',
        },
      ],
    },
    body: `    <p class="eyebrow">Personal trainer software</p>
    <h1>Personal trainer software: what it does, and what to look for</h1>
    <p class="lede">Most independent trainers do not start with software. They start with a phone,
      a calendar and a spreadsheet, and those work — right up until the point they quietly stop
      working. This page is about what that point looks like, what this category of software
      actually does, and how to judge one without sitting through a sales call.</p>

    <h2>What personal trainer software is</h2>
    <p>It is a single place to hold the operational side of a coaching business: who your clients
      are, when they train, what they have paid for, how many sessions are left on that, and what
      has changed for them since they started.</p>
    <p>That is a deliberately unglamorous list. The value is not in any one of those things — you
      already track all of them somewhere. It is that they stop being <strong>five separate
      records that only you know how to reconcile</strong>.</p>

    <h2>The problem it solves is copies, not effort</h2>
    <p>Consider one ordinary event: a client reschedules Thursday to Friday.</p>
    <ul>
      <li>The calendar entry moves.</li>
      <li>The message thread now contradicts the calendar.</li>
      <li>The spreadsheet still has the old date, if it has dates at all.</li>
      <li>The session count is unchanged, which is correct — but you had to think about it.</li>
    </ul>
    <p>Nothing there is hard. The difficulty is that one fact now lives in three places, and copies
      drift. Every "wait, have you already paid for this block?" conversation is a copy that
      drifted. Software helps by making it one fact.</p>

    <h2>Six things worth checking before you pick one</h2>
    <ol>
      <li><strong>Does it count sessions down on its own?</strong> If you still tally a package by
        hand, the single most error-prone job in the business is unchanged.</li>
      <li><strong>Does it tell you before a package runs out?</strong> Finding out during the last
        session is the expensive version of that information.</li>
      <li><strong>Do payments sit next to the sessions they paid for?</strong> Separated, you are
        back to reconciling two lists.</li>
      <li><strong>Can you record what actually happened?</strong> Completed, cancelled and no-show
        are different facts, and a system that only stores what was booked will always disagree
        with reality.</li>
      <li><strong>How long until your first client is in it?</strong> If it needs configuring
        before it does anything, you will not finish.</li>
      <li><strong>Can you get your data out?</strong> Export and account deletion are the questions
        to ask on day one, not the day you want to leave.</li>
    </ol>

    <h2>When you do not need this yet</h2>
    <p>If you have four clients, train them at fixed times, and get paid in cash each session, a
      notebook is genuinely fine and any software is overhead. The honest threshold is not a client
      count — it is the first time you cannot answer <em>"how many sessions has she got left, and
      has she paid for them?"</em> without opening two apps.</p>
    <p>The second signal is admin drifting to the end of the day. Nobody became a trainer to do
      data entry at 21:40; if that is when it happens, it is because the information was never in
      one place while you were standing in the gym.</p>

    <h2>Software versus a spreadsheet</h2>
    <p>A spreadsheet is not the wrong tool — it is the right tool for a while, and it is free. The
      trade-off is that it does not enforce anything: nothing stops two rows disagreeing, nothing
      counts down, and nothing warns you. We wrote that comparison out properly in
      <a href="/guides/software-vs-spreadsheets">personal trainer software vs spreadsheets</a>.</p>

    <h2>Where TRENIKO fits</h2>
    <p>TRENIKO is training management software for independent personal trainers — the people who
      coach and run the business themselves. It holds clients, sessions, packages, payments,
      progress and training plans in one workspace. It is not a gym system with the gym removed:
      there is no membership billing, no front desk and no class-booking portal to configure.</p>
    <p>It is early, and it says so. There are no customer numbers on this site because there is
      nothing worth quoting yet.</p>
${cta('Start with the clients you already have. Adding one and booking a session takes a couple of minutes, which is enough to tell whether it fits how you work.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/guides/client-management">
        <h3>What to actually track per client</h3>
        <p>A short list that stays useful, and the fields that quietly become dead weight.</p>
      </a>
      <a class="card" href="/guides/session-packages">
        <h3>Tracking packages and remaining sessions</h3>
        <p>Why the count goes wrong, and the rule that keeps it right.</p>
      </a>
    </div>`,
  });
}

/* 2 ── /guides ────────────────────────────────────────────────────────────── */
{
  const path = '/guides';
  const crumbs = [{ name: 'TRENIKO', path: '/' }, { name: 'Guides', path }];
  const title = 'Guides for Personal Trainers Running Their Own Business | TRENIKO';
  const description =
    'Practical guides on managing personal training clients, tracking session packages, and deciding when a spreadsheet stops being enough.';

  PAGES.push({
    path,
    title,
    description,
    crumbs,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumb(crumbs),
        ORG,
        {
          '@type': 'CollectionPage',
          '@id': `${ORIGIN}${path}#webpage`,
          url: `${ORIGIN}${path}`,
          name: title,
          description,
          inLanguage: 'en',
        },
      ],
    },
    body: `    <p class="eyebrow">Guides</p>
    <h1>Guides for trainers who also run the business</h1>
    <p class="lede">Short, practical write-ups on the operational side of personal training — the
      part nobody certifies you in. No sign-up required to read any of them.</p>

    <div class="cards">
      <a class="card" href="/guides/client-management">
        <h3>How to manage personal training clients</h3>
        <p>What to record per client, what to leave out, and the review habit that makes a
          check-in start from the record instead of from memory.</p>
      </a>
      <a class="card" href="/guides/session-packages">
        <h3>Tracking training packages and remaining sessions</h3>
        <p>Why the session count drifts, what a package actually needs to store, and the rule that
          keeps it honest.</p>
      </a>
      <a class="card" href="/guides/software-vs-spreadsheets">
        <h3>Personal trainer software vs spreadsheets</h3>
        <p>An honest comparison, including the cases where the spreadsheet wins and you should
          keep it.</p>
      </a>
      <a class="card" href="/personal-trainer-software">
        <h3>Personal trainer software: what to look for</h3>
        <p>Six things worth checking before you pick one, and how to tell when you do not need
          one yet.</p>
      </a>
      <a class="card" href="/free-personal-trainer-client-tracker">
        <h3>Free client &amp; session tracker</h3>
        <p>A spreadsheet template where the remaining-session count works itself out. No
          sign-up needed.</p>
      </a>
    </div>`,
  });
}

/* 3 ── /guides/client-management ──────────────────────────────────────────── */
{
  const path = '/guides/client-management';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'Managing clients', path },
  ];
  const title = 'How to Manage Personal Training Clients (Without a System That Rots) | TRENIKO';
  const description =
    'What to track for each personal training client, what to deliberately leave out, and how to run a check-in from the record instead of from memory.';

  PAGES.push({
    path,
    title,
    description,
    crumbs,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumb(crumbs),
        ORG,
        {
          '@type': 'Article',
          '@id': `${ORIGIN}${path}#article`,
          headline: 'How to manage personal training clients without a system that rots',
          description,
          inLanguage: 'en',
          author: { '@id': `${ORIGIN}/#organization` },
          publisher: { '@id': `${ORIGIN}/#organization` },
          mainEntityOfPage: `${ORIGIN}${path}`,
          image: `${ORIGIN}/og-image.png`,
        },
      ],
    },
    body: `    <p class="eyebrow">Guide</p>
    <h1>How to manage personal training clients</h1>
    <p class="meta">A practical structure that survives contact with a busy week.</p>
    <p class="lede">Most client-tracking systems do not fail because they were badly designed. They
      fail because they asked for more than anyone can maintain between sessions, so they went
      stale, and a stale record is worse than none — you stop trusting it and go back to memory.</p>

    <h2>Track less than you think, but track it every time</h2>
    <p>The test for any field is simple: <strong>would you actually fill this in at 07:55 with a
      client walking through the door?</strong> If not, it will be blank within a fortnight and it
      will make the whole record look unreliable.</p>
    <p>A list that survives that test:</p>
    <ul>
      <li><strong>Goal, in the client's own words.</strong> Not "hypertrophy" — the sentence they
        actually said. It is what you repeat back to them in month three.</li>
      <li><strong>Constraints.</strong> The shoulder, the shift pattern, the knee that objects to
        lunges. This is the field that saves you from programming something you have to undo.</li>
      <li><strong>What they are on.</strong> Which package, and how many sessions remain.</li>
      <li><strong>Payment status.</strong> Paid or outstanding, against the block it covers.</li>
      <li><strong>Session history.</strong> What happened, not what was booked — including the
        no-shows.</li>
      <li><strong>A small number of measurements</strong>, taken the same way each time.</li>
    </ul>

    <h2>What to leave out</h2>
    <p>Anything you would have to ask permission to store and then never look at. Detailed medical
      history you are not qualified to act on, notes about a client's relationships, anything you
      would be uncomfortable showing the client if they asked to see it — and under GDPR in the EU,
      they can ask.</p>
    <p>A good filter: <em>if this client read their own record, would it look professional?</em>
      Write it as though they will, because they are entitled to.</p>

    <h2>Record what happened, not what was planned</h2>
    <p>This is the single change that makes a client history worth having. A calendar tells you
      what was booked. It does not know that Thursday was cancelled with two hours' notice, or that
      the 18:30 was a no-show for the second time this month.</p>
    <p>Those are the facts you need when a package does not add up, or when you are deciding
      whether to keep a slot open for someone. Three states cover almost everything:
      <strong>completed</strong>, <strong>cancelled</strong>, <strong>no-show</strong>. If your
      system cannot express the difference, it will always disagree with reality.</p>

    <h2>Make the check-in start from the record</h2>
    <p>A check-in goes badly for one reason: you are reconstructing the last month from memory
      while the client sits in front of you. Four things, looked at for ninety seconds beforehand,
      remove that entirely:</p>
    <ol>
      <li>What they said they wanted, at the start.</li>
      <li>Sessions completed since the last check-in — the actual number.</li>
      <li>Whatever you measure, then and now.</li>
      <li>One thing that changed which they may not have noticed themselves.</li>
    </ol>
    <p>That last one is the whole point. Clients rarely notice their own progress; noticing it for
      them, specifically, is a large part of what they are paying for.</p>

    <h2>Archive rather than delete</h2>
    <p>Clients pause. They come back more often than you expect, and when they do, the history is
      the reason the first session back is good rather than a re-assessment. Keep the record, free
      the slot.</p>

    <h2>A weekly habit that costs ten minutes</h2>
    <ul>
      <li>Anyone with two or fewer sessions left — say something this week, not next.</li>
      <li>Anyone with an outstanding payment — one message, not a mental note.</li>
      <li>Anyone who has not trained in three weeks and has not said why.</li>
    </ul>
    <p>Those three questions are most of client retention, and none of them requires software. They
      do require the answers to be visible in one place, which is where most systems fall down.</p>
${cta('TRENIKO keeps this structure by default: one record per client with goals, private notes, session history and payments, and packages that count themselves down.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/guides/session-packages">
        <h3>Tracking packages and remaining sessions</h3>
        <p>The arithmetic that goes wrong, and why it is rarely the arithmetic.</p>
      </a>
      <a class="card" href="/guides/software-vs-spreadsheets">
        <h3>Software vs spreadsheets</h3>
        <p>When the spreadsheet is still the right answer.</p>
      </a>
    </div>`,
  });
}

/* 4 ── /guides/session-packages ───────────────────────────────────────────── */
{
  const path = '/guides/session-packages';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'Session packages', path },
  ];
  const title = 'Tracking Personal Training Packages and Remaining Sessions | TRENIKO';
  const description =
    'Why the remaining-session count on a training package drifts, what a package actually needs to record, and a rule that keeps it honest.';

  PAGES.push({
    path,
    title,
    description,
    crumbs,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumb(crumbs),
        ORG,
        {
          '@type': 'Article',
          '@id': `${ORIGIN}${path}#article`,
          headline: 'Tracking personal training packages and remaining sessions',
          description,
          inLanguage: 'en',
          author: { '@id': `${ORIGIN}/#organization` },
          publisher: { '@id': `${ORIGIN}/#organization` },
          mainEntityOfPage: `${ORIGIN}${path}`,
          image: `${ORIGIN}/og-image.png`,
        },
      ],
    },
    body: `    <p class="eyebrow">Guide</p>
    <h1>Tracking training packages and remaining sessions</h1>
    <p class="meta">The most common source of awkward conversations in a coaching business.</p>
    <p class="lede">Selling ten sessions for one price is the simplest product in personal
      training and the easiest thing in the business to get wrong. Not because the arithmetic is
      hard — because the number lives in your head, and heads are not databases.</p>

    <h2>Why the count drifts</h2>
    <p>It is almost never a subtraction error. It is a disagreement about what counts:</p>
    <ul>
      <li>A session cancelled four hours beforehand. Does it come off the block?</li>
      <li>A no-show. Same question, different answer for most trainers.</li>
      <li>A session you moved for your own reasons.</li>
      <li>A free one you threw in and then forgot you had.</li>
      <li>Two blocks bought before the first was finished.</li>
    </ul>
    <p>Each is defensible. The problem is that the answer was decided in the moment and never
      written anywhere, so three months later you and the client have two different numbers and
      both of you are honest.</p>

    <h2>Decide the policy once, in writing</h2>
    <p>Not for legal reasons — so that the number stops being a judgement call. A workable default,
      stated to the client when they buy:</p>
    <div class="table-scroll">
      <table>
        <thead><tr><th>What happened</th><th>Comes off the package?</th></tr></thead>
        <tbody>
          <tr><td>Session completed</td><td>Yes</td></tr>
          <tr><td>Cancelled with more than 24 hours' notice</td><td>No — rebooked</td></tr>
          <tr><td>Cancelled with less than 24 hours' notice</td><td>Yes</td></tr>
          <tr><td>No-show</td><td>Yes</td></tr>
          <tr><td>Cancelled by you</td><td>No</td></tr>
        </tbody>
      </table>
    </div>
    <p>The exact rules matter less than having them. Whatever you choose, the client should hear it
      before it first costs them a session, not afterwards.</p>

    <h2>What a package actually needs to record</h2>
    <ul>
      <li><strong>Sessions bought</strong>, and what was paid for them.</li>
      <li><strong>Sessions used</strong>, derived from the session history rather than typed in.
        A number you maintain by hand is a number that drifts.</li>
      <li><strong>An expiry, if there is one.</strong> "Ten sessions, within four months" is a
        different product from "ten sessions" and needs saying up front.</li>
      <li><strong>Payment status</strong>, attached to this block and not floating loose.</li>
    </ul>
    <p>If used sessions are calculated from what actually happened, the count cannot disagree with
      the history — because it is the history.</p>

    <h2>Warn early, at two remaining</h2>
    <p>Not one, and not zero. Two sessions of notice is roughly a week for most clients, which is
      enough to have a renewal conversation without it happening in the doorway at the end of the
      last session — the worst possible moment for both of you, because it sounds like a sales
      pitch attached to a goodbye.</p>
    <p>The same applies to time-limited packages: a week before expiry is useful, the day after is
      an apology.</p>

    <h2>A quick self-check</h2>
    <p>Pick three current clients and answer, without opening more than one thing: how many sessions
      do they have left, and is that block paid for?</p>
    <p>If you cannot, the issue is not discipline. It is that the answer is spread across a
      calendar, a chat thread and a spreadsheet, and only you know how to combine them.</p>
${cta('In TRENIKO a package counts down as sessions are marked completed, and it flags a client at two sessions remaining, or before a time-limited package expires.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/free-personal-trainer-client-tracker">
        <h3>Free client &amp; session tracker template</h3>
        <p>A spreadsheet that does the countdown for you. No sign-up needed.</p>
      </a>
      <a class="card" href="/guides/client-management">
        <h3>How to manage personal training clients</h3>
        <p>What to track per client, and what to deliberately leave out.</p>
      </a>
    </div>`,
  });
}

/* 5 ── /guides/software-vs-spreadsheets ───────────────────────────────────── */
{
  const path = '/guides/software-vs-spreadsheets';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'Software vs spreadsheets', path },
  ];
  const title = 'Personal Trainer Software vs Spreadsheets: An Honest Comparison | TRENIKO';
  const description =
    'Where a spreadsheet genuinely wins, the four things it cannot do for a coaching business, and how to tell which side of the line you are on.';

  PAGES.push({
    path,
    title,
    description,
    crumbs,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumb(crumbs),
        ORG,
        {
          '@type': 'Article',
          '@id': `${ORIGIN}${path}#article`,
          headline: 'Personal trainer software vs spreadsheets: an honest comparison',
          description,
          inLanguage: 'en',
          author: { '@id': `${ORIGIN}/#organization` },
          publisher: { '@id': `${ORIGIN}/#organization` },
          mainEntityOfPage: `${ORIGIN}${path}`,
          image: `${ORIGIN}/og-image.png`,
        },
      ],
    },
    body: `    <p class="eyebrow">Guide</p>
    <h1>Personal trainer software vs spreadsheets</h1>
    <p class="meta">Written by people who make the software, so read the first section first.</p>
    <p class="lede">We build training management software, which makes this a comparison with an
      obvious bias. So here is the part that cuts against us: for a lot of trainers, a spreadsheet
      is the correct tool, and switching would be a downgrade.</p>

    <h2>Where the spreadsheet genuinely wins</h2>
    <ul>
      <li><strong>It is free, and it is already open.</strong> No account, no migration, no
        learning anything.</li>
      <li><strong>It bends.</strong> A column for whatever you happen to care about this month,
        added in four seconds. No software will ever match that.</li>
      <li><strong>You can see everything at once.</strong> For a small book of clients, one screen
        genuinely is the whole business.</li>
      <li><strong>Nobody can take it away.</strong> It is a file. It does not change its pricing or
        get acquired.</li>
    </ul>
    <p>If you have a handful of clients on fixed times who pay per session, that list is decisive.
      Keep the spreadsheet.</p>

    <h2>The four things it cannot do</h2>
    <ol>
      <li><strong>Enforce anything.</strong> Nothing stops "10-session pack" in one row and
        "10 session pack" in another, and nothing notices that a client appears twice.</li>
      <li><strong>Count down by itself.</strong> Every remaining-session number is one you typed,
        which means it is only right until the next time you forget.</li>
      <li><strong>Tell you something.</strong> A spreadsheet is answered, never asked. It will
        never mention that someone has two sessions left, because it is not running when you are
        not looking at it.</li>
      <li><strong>Connect a payment to the sessions it bought.</strong> You can put them in one
        file, but keeping them consistent is manual work forever.</li>
    </ol>

    <h2>Side by side</h2>
    <div class="table-scroll">
      <table>
        <thead><tr><th>&nbsp;</th><th>Spreadsheet</th><th>Training software</th></tr></thead>
        <tbody>
          <tr><td>Cost to start</td><td>Free</td><td>Often free at small scale</td></tr>
          <tr><td>Setup time</td><td>Minutes</td><td>Minutes to an evening</td></tr>
          <tr><td>Flexibility</td><td>Total</td><td>Limited to what it models</td></tr>
          <tr><td>Session countdown</td><td>Manual</td><td>Automatic, if it is any good</td></tr>
          <tr><td>Alerts before a package ends</td><td>None</td><td>Usually</td></tr>
          <tr><td>Payment linked to sessions</td><td>By hand</td><td>Structural</td></tr>
          <tr><td>History of what actually happened</td><td>If you maintain it</td><td>A by-product of using it</td></tr>
          <tr><td>Usable on a phone between sessions</td><td>Awkward</td><td>Usually fine</td></tr>
          <tr><td>Risk of two rows disagreeing</td><td>Permanent</td><td>Largely removed</td></tr>
        </tbody>
      </table>
    </div>

    <h2>How to tell which side you are on</h2>
    <p>Not a client count — trainers cross this line at wildly different sizes. Three questions:</p>
    <ol>
      <li>Can you answer "how many sessions has she got left, and has she paid?" from one place?</li>
      <li>Has a client corrected your session count in the last six months?</li>
      <li>Does the admin happen at the end of the day rather than as you go?</li>
    </ol>
    <p>One "no" is normal. Two or three, and the spreadsheet is costing you more than it saves —
      not in hours, but in the small ongoing tax of holding it all in your head.</p>

    <h2>If you do move</h2>
    <p>Do not migrate everything. Put in the clients you have <em>now</em>, book the coming week,
      and give anyone on a block their package. That is roughly twenty minutes and it is enough to
      tell whether the thing fits. Historical data can stay in the spreadsheet; it is not doing any
      harm there, and importing it is the step where most people give up.</p>
${cta('TRENIKO is built for exactly this handover: no setup wizard, no configuration before it does anything, and your data exportable from the first day in case you decide to go back.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/guides/session-packages">
        <h3>Tracking packages and remaining sessions</h3>
        <p>The count that drifts, and the policy that stops it.</p>
      </a>
      <a class="card" href="/guides/client-management">
        <h3>How to manage personal training clients</h3>
        <p>A structure that survives a busy week.</p>
      </a>
    </div>`,
  });
}

/* 6 ── /free-personal-trainer-client-tracker ──────────────────────────────── */
{
  const path = '/free-personal-trainer-client-tracker';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Free client & session tracker', path },
  ];
  const title = 'Free Personal Trainer Client & Session Tracker (Spreadsheet) | TRENIKO';
  const description =
    'A free spreadsheet template for personal trainers: clients, packages, sessions used and remaining, payments. Remaining sessions calculate themselves. No sign-up, no email required.';
  const FILE = '/downloads/treniko-client-session-tracker.csv';

  PAGES.push({
    path,
    title,
    description,
    crumbs,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumb(crumbs),
        ORG,
        {
          // The thing on offer really is a downloadable file, described the way
          // it actually behaves. No rating, no review, no price theatre.
          '@type': 'HowTo',
          '@id': `${ORIGIN}${path}#howto`,
          name: 'How to track personal training clients and remaining sessions in a spreadsheet',
          description,
          inLanguage: 'en',
          totalTime: 'PT10M',
          supply: { '@type': 'HowToSupply', name: 'A spreadsheet application (Excel, Google Sheets, LibreOffice or Numbers)' },
          step: [
            { '@type': 'HowToStep', name: 'Download and open the template', text: 'Download the CSV and open it in your spreadsheet application. No account or sign-up is needed.' },
            { '@type': 'HowToStep', name: 'Add one row per client', text: 'Fill in the client, the package they are on, how many sessions it contains and how many they have used.' },
            { '@type': 'HowToStep', name: 'Let the remaining count calculate itself', text: 'The remaining-sessions column is a formula. Never type over it — a hand-maintained count is the number that drifts.' },
            { '@type': 'HowToStep', name: 'Decide your cancellation policy once', text: 'Write down whether a late cancellation or a no-show uses a session, and tell the client before it first costs them one.' },
            { '@type': 'HowToStep', name: 'Run the weekly check', text: 'Each week look at anyone with two or fewer sessions left, anyone with an outstanding payment, and anyone who has not trained in three weeks.' },
          ],
        },
      ],
    },
    body: `    <p class="eyebrow">Free template</p>
    <h1>Free personal trainer client &amp; session tracker</h1>
    <p class="lede">A spreadsheet for keeping track of who your clients are, what they
      bought, how many sessions they have left and whether they have paid. The remaining
      count works itself out. No sign-up, no email address, nothing to buy.</p>

    <div class="cta-row">
      <a class="btn" href="${FILE}" download>Download the template (CSV, 2 KB)</a>
    </div>
    <p style="font-size:14px;color:#6b7280">Opens in Excel, Google Sheets, LibreOffice and Numbers.
      In Google Sheets: <em>File → Import → Upload</em>.</p>

    <h2>What is in it</h2>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Column</th><th>What it is for</th></tr></thead>
        <tbody>
          <tr><td>Client · Contact</td><td>Who they are and how you reach them.</td></tr>
          <tr><td>Package</td><td>What they actually bought — "10-session pack", not "training".</td></tr>
          <tr><td>Sessions bought · used</td><td>The two numbers you maintain. Update <em>used</em> when a session is completed, not when it is booked.</td></tr>
          <tr><td><strong>Sessions remaining</strong></td><td><strong>A formula.</strong> It subtracts used from bought every time you open the file, so it cannot drift out of step with the other two.</td></tr>
          <tr><td>Package start · expires</td><td>"Ten sessions within four months" is a different product from "ten sessions", and the difference needs writing down.</td></tr>
          <tr><td>Amount paid · status</td><td>So "has this one paid?" is answered by looking rather than remembering.</td></tr>
          <tr><td>Notes</td><td>The shoulder, the shift pattern, the knee that objects to lunges.</td></tr>
        </tbody>
      </table>
    </div>

    <h2>The one column that matters</h2>
    <p>Remaining sessions is a formula, and that is deliberate. Almost every awkward
      conversation about a package comes from a number somebody typed and then forgot to
      update — you and the client end up with different totals and both of you are being
      honest. A calculated column cannot disagree with the numbers it is calculated from.</p>
    <p>The other half of that problem is not arithmetic at all: it is that nobody wrote
      down whether a late cancellation uses a session. Decide it once, put it in Notes,
      and say it when they buy. We go through the options in
      <a href="/guides/session-packages">tracking packages and remaining sessions</a>.</p>

    <h2>The weekly check</h2>
    <p>Ten minutes, and it is most of client retention:</p>
    <ul>
      <li>Anyone with <strong>two or fewer sessions left</strong> — say something this week,
        not during their last session.</li>
      <li>Anyone with an <strong>outstanding payment</strong> — one message, not a mental note.</li>
      <li>Anyone who <strong>has not trained in three weeks</strong> and has not said why.</li>
    </ul>
    <p>None of that needs software. It needs the answers to be visible in one place, which
      is exactly what the template is for.</p>

    <h2>When a spreadsheet stops being enough</h2>
    <p>Honestly: for a lot of trainers it never does, and this file is the whole solution.
      It is free, it is yours, and nobody can change its pricing.</p>
    <p>It starts to cost you when the same fact lives in two places — sessions in a
      calendar, payments in the spreadsheet — and the two disagree. A spreadsheet cannot
      count down on its own, cannot warn you before a package runs out, and cannot tell you
      anything, because it is only ever answered and never asked. We wrote that comparison
      out properly, including the cases where the spreadsheet wins, in
      <a href="/guides/software-vs-spreadsheets">software vs spreadsheets</a>.</p>
${cta('TRENIKO does what this template does, without the copying: packages count down as sessions are completed, alerts arrive at two sessions remaining, and payments sit against the sessions they paid for.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/guides/client-management">
        <h3>How to manage personal training clients</h3>
        <p>What to record per client, and what to deliberately leave out.</p>
      </a>
      <a class="card" href="/personal-trainer-software">
        <h3>What to look for in personal trainer software</h3>
        <p>Six checks — and how to tell when you do not need any of it yet.</p>
      </a>
    </div>`,
  });
}

/* ── Write ─────────────────────────────────────────────────────────────────── */

for (const p of PAGES) {
  const dir = join(PUBLIC, p.path.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(p), 'utf8');
  console.log(`  wrote ${p.path}/index.html`);
}
console.log(`\n${PAGES.length} content pages generated into frontend/public/.`);
