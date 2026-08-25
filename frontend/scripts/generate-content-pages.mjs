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

import { writeFileSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');
const ORIGIN = 'https://treniko.com';

/* ── The stylesheet, content-hashed ────────────────────────────────────────── */

/**
 * These pages used to link `/assets-static/content.css` — a fixed filename
 * served with `Cache-Control: max-age=14400`. That combination is a deployment
 * bug, and it was caught in production: a stylesheet change deployed
 * successfully to the server, and Cloudflare kept serving the previous file
 * from its edge cache for the next four hours. `cf-cache-status: HIT`,
 * `Age: 3593`, and a mobile nav that had been fixed but did not look fixed.
 *
 * Vite already solved this for the application bundle by putting a content hash
 * in the filename, which is what makes `immutable` safe there. The static pages
 * did not get that treatment because nothing was building them.
 *
 * So the generator does it: the emitted filename carries a hash of the file's
 * own bytes. Change the CSS and the URL changes, so no cache anywhere can serve
 * the old one; leave it alone and the URL is stable, so every cache keeps
 * working. `content.css` remains the hand-edited source.
 */
const CSS_SOURCE = join(PUBLIC, 'assets-static', 'content.css');
const cssBytes = readFileSync(CSS_SOURCE);
const cssHash = createHash('sha256').update(cssBytes).digest('hex').slice(0, 10);
const CSS_HREF = `/assets-static/content.${cssHash}.css`;

writeFileSync(join(PUBLIC, 'assets-static', `content.${cssHash}.css`), cssBytes);

// Previous hashes would otherwise accumulate in the repository forever, one per
// stylesheet edit, all of them unreferenced.
for (const f of readdirSync(join(PUBLIC, 'assets-static'))) {
  if (/^content\.[0-9a-f]{10}\.css$/.test(f) && f !== `content.${cssHash}.css`) {
    unlinkSync(join(PUBLIC, 'assets-static', f));
  }
}

/* ── Shared chrome ─────────────────────────────────────────────────────────── */

const LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><rect width="100" height="100" rx="22" fill="#0ea5e9"/><rect x="19" y="28" width="62" height="16" rx="3.2" fill="#fff"/><rect x="42" y="28" width="16" height="48" rx="3.2" fill="#fff"/></svg>`;

const header = () => `  <header class="site">
    <div class="wrap-wide bar">
      <a class="brand" href="/">${LOGO}TRENIKO</a>
      <nav>
        <a href="/personal-trainer-software">Software</a>
        <a href="/guides">Guides</a>
        <a href="/free-personal-trainer-client-tracker">Free tracker</a>
        <a href="/personal-trainer-pricing-calculator">Calculator</a>
        <a href="/">Product</a>
      </nav>
    </div>
  </header>`;

const footer = () => `  <footer class="site">
    <div class="wrap">
      <div class="links">
        <a href="/">TRENIKO</a>
        <a href="/personal-trainer-software">Personal trainer software</a>
        <a href="/personal-trainer-client-management-software">Client management software</a>
        <a href="/guides">Guides</a>
        <a href="/free-personal-trainer-client-tracker">Free tracker</a>
        <a href="/personal-trainer-pricing-calculator">Pricing calculator</a>
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
/**
 * The page-view beacon and the UTM hand-off, emitted as an external file.
 *
 * ── Why it stopped being inline ──────────────────────────────────────────────
 * It was an inline <script>, which is the one thing that makes a strict
 * Content-Security-Policy impossible: `script-src 'self'` blocks it, and the
 * alternatives are `'unsafe-inline'` (which disables the protection the header
 * exists to provide) or a sha256 hash in the nginx config that has to be kept
 * in sync with a string in this file by hand. Neither survives contact with a
 * future edit.
 *
 * As a file it is also cached once and reused across every content page,
 * instead of being re-sent in the body of each one.
 *
 * The filename carries a hash of its own bytes, for the same reason the
 * stylesheet does: a fixed name plus a long cache is a change nobody sees.
 *
 * ── What it does, unchanged ──────────────────────────────────────────────────
 * 1. **Counts the view.** Same contract as the React beacon in
 *    src/utils/pageView.js: no cookie, no storage, no identifier, fire and
 *    forget, and a failure is invisible.
 *
 * 2. **Carries the campaign across.** Someone arriving from Reddit lands on a
 *    guide, not on `/`, so the React attribution capture — which only runs
 *    inside the app — never sees the UTM tags and the signup is recorded as
 *    direct. Any incoming utm_* parameters are appended to the links that lead
 *    into the app, so the existing first-touch capture picks them up unchanged.
 *    Nothing is invented: no tags in, no tags out.
 */
const BEACON_SOURCE = `(function () {
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

      // Count downloads of the free tracker.
      //
      // The file is served straight off disk by nginx, so a download never
      // reaches the application and never appears in page_view. That left the
      // most important step of the whole funnel unmeasured: we could see how
      // many people reached the tracker page and had no idea how many of them
      // actually took the file. Views without downloads and views with them are
      // the difference between a page that needs rewriting and one that works.
      //
      // The download's own path is sent as the event, so it shows up in the
      // admin page breakdown next to the page that led to it, with whatever
      // campaign tags brought the visitor in. Same beacon, same endpoint, no new
      // table and nothing identifying.
      document.querySelectorAll('a[href^="/downloads/"]').forEach(function (a) {
        a.addEventListener('click', function () {
          try {
            var d = { path: a.getAttribute('href').split('?')[0] };
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
              if (body[k]) d[k] = body[k];
            });
            if (body.referrer_host) d.referrer_host = body.referrer_host;
            if (navigator.sendBeacon) {
              navigator.sendBeacon(
                '/api/metrics/view',
                new Blob([JSON.stringify(d)], { type: 'application/json' })
              );
            }
          } catch (e) { /* a click must never be blocked by its own counter */ }
        });
      });
    } catch (e) { /* a counter must never break the page it counts */ }
  })();
`;

const beaconHash = createHash('sha256').update(BEACON_SOURCE).digest('hex').slice(0, 10);
const BEACON_HREF = `/assets-static/beacon.${beaconHash}.js`;

writeFileSync(join(PUBLIC, 'assets-static', `beacon.${beaconHash}.js`), BEACON_SOURCE, 'utf8');

for (const f of readdirSync(join(PUBLIC, 'assets-static'))) {
  if (/^beacon\.[0-9a-f]{10}\.js$/.test(f) && f !== `beacon.${beaconHash}.js`) {
    unlinkSync(join(PUBLIC, 'assets-static', f));
  }
}

// `defer` rather than inline-at-end-of-body: it runs after the document is
// parsed, which is what the inline version relied on for the link rewrite.
const beacon = () => `  <script src="${BEACON_HREF}" defer></script>`;

/**
 * Write a page-specific script as `/assets-static/<name>.<hash>.js` and return
 * its href.
 *
 * Interactive pages cannot use an inline <script>: the Content-Security-Policy
 * on this site is `script-src 'self'` with no hashes and no nonces, which is
 * only sustainable because nothing inline exists to accommodate. A tool page
 * that reached for an inline handler would force the policy to be weakened for
 * every page on the site.
 */
function emitScript(name, source) {
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 10);
  const file = `${name}.${hash}.js`;
  writeFileSync(join(PUBLIC, 'assets-static', file), source, 'utf8');
  for (const f of readdirSync(join(PUBLIC, 'assets-static'))) {
    if (new RegExp(`^${name}\.[0-9a-f]{10}\.js$`).test(f) && f !== file) {
      unlinkSync(join(PUBLIC, 'assets-static', f));
    }
  }
  return `/assets-static/${file}`;
}

/**
 * Build one page.
 *
 * `jsonld` is passed through verbatim, so every schema block is written
 * deliberately next to the content it describes rather than assembled from
 * guesswork here. Nothing may claim a rating, a review or a price.
 */
function page({ path, title, description, crumbs, jsonld, body, script }) {
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

<link rel="stylesheet" href="${CSS_HREF}">
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
${script ? `  <script src="${script}" defer></script>
` : ''}</body>
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
  const title = 'Personal Trainer Software: What to Look For | TRENIKO';
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
        are <a href="/guides/no-show-clients">different facts with different consequences</a>, and a
        system that only stores what was booked will always disagree with reality.</li>
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
      <a class="card" href="/personal-trainer-client-management-software">
        <h3>Client management software for trainers</h3>
        <p>The five questions it has to answer instantly, and why gym systems fail solo
          trainers.</p>
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
    'Practical guides on the business side of personal training: clients, session packages, pricing, cancellations, no-shows and onboarding. No sign-up to read.';

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
      part nobody certifies you in. Nothing here requires a sign-up, and several of them conclude
      that you do not need software.</p>

    <h2>Running the day to day</h2>
    <div class="cards">
      <a class="card" href="/guides/client-management">
        <h3>How to manage personal training clients</h3>
        <p>What to record per client, what to leave out, and the review habit that makes a
          check-in start from the record instead of from memory.</p>
      </a>
      <a class="card" href="/guides/new-client-first-week">
        <h3>A new client’s first week</h3>
        <p>What to collect before session one, the baseline you cannot go back for, and what to
          deliberately not ask.</p>
      </a>
    </div>

    <h2>Sessions, packages and money</h2>
    <div class="cards">
      <a class="card" href="/guides/session-packages">
        <h3>Tracking packages and remaining sessions</h3>
        <p>Why the session count drifts, what a package actually needs to store, and the rule that
          keeps it honest.</p>
      </a>
      <a class="card" href="/guides/pricing-personal-training-packages">
        <h3>Pricing personal training packages</h3>
        <p>The unpaid hours to count first, what a discount actually buys, and how to set an
          expiry that is not a trap.</p>
      </a>
      <a class="card" href="/guides/cancellation-policy">
        <h3>Writing a cancellation policy that holds</h3>
        <p>The four things it has to decide, where the 24-hour rule breaks, and how to enforce it
          without the confrontation.</p>
      </a>
      <a class="card" href="/guides/no-show-clients">
        <h3>When a client does not show up</h3>
        <p>Why a no-show is a different fact from a cancellation, what to do the same day, and
          what a second one means.</p>
      </a>
    </div>

    <h2>Tools and software</h2>
    <div class="cards">
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
      <a class="card" href="/personal-trainer-client-management-software">
        <h3>Client management software for trainers</h3>
        <p>The five questions it has to answer instantly, and why gym systems fail solo
          trainers.</p>
      </a>
      <a class="card" href="/free-personal-trainer-client-tracker">
        <h3>Free client &amp; session tracker</h3>
        <p>A spreadsheet where the remaining-session count works itself out. Excel or Google
          Sheets, no sign-up.</p>
      </a>
      <a class="card" href="/personal-trainer-pricing-calculator">
        <h3>Free pricing calculator</h3>
        <p>What an hour really pays once prep, travel and messages are counted — and what a
          package discount actually costs.</p>
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
  const title = 'How to Manage Personal Training Clients | TRENIKO';
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
      <a class="card" href="/guides/new-client-first-week">
        <h3>A new client’s first week</h3>
        <p>What to collect before session one, and the baseline you cannot go back for.</p>
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
  const title = 'How to Track Training Packages and Sessions Left | TRENIKO';
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
      <li>A session cancelled four hours beforehand. Does it come off the block?
        <a href="/guides/cancellation-policy">Write the policy once</a> and it stops being a
        decision.</li>
      <li>A <a href="/guides/no-show-clients">no-show</a>. Same question, different answer for
        most trainers.</li>
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
      <li><strong>An <a href="/guides/pricing-personal-training-packages">expiry</a>, if there is
        one.</strong> "Ten sessions, within four months" is a
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
      <a class="card" href="/guides/pricing-personal-training-packages">
        <h3>Pricing personal training packages</h3>
        <p>What a discount actually buys, and how to set an expiry that is not a trap.</p>
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
  const title = 'Personal Trainer Software vs Spreadsheets | TRENIKO';
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
      <a class="card" href="/personal-trainer-client-management-software">
        <h3>Client management software for trainers</h3>
        <p>What it has to do before it is worth moving off the sheet.</p>
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
  const title = 'Free Personal Trainer Client &amp; Session Tracker | TRENIKO';
  const description =
    'A free Excel and Google Sheets template: clients, packages, sessions used and remaining, payments. The remaining count calculates itself. No sign-up needed.';
  // Two formats, and the order is the point. Excel splits a .csv on the system
  // list separator, which is `;` across most of continental Europe — including
  // Croatia, the first market. A comma-delimited CSV opened there is one column
  // of long strings with no working formulas, which is the template failing for
  // exactly the trainer it was written for. The .xlsx has no separator to get
  // wrong, so it leads; the CSV stays for importing elsewhere.
  const XLSX = '/downloads/treniko-client-session-tracker.xlsx';
  const CSV = '/downloads/treniko-client-session-tracker.csv';

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
            { '@type': 'HowToStep', name: 'Download and open the template', text: 'Download the Excel file and open it in Excel, Google Sheets, LibreOffice or Numbers. No account or sign-up is needed.' },
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
      <a class="btn" href="${XLSX}" download>Download the template (Excel, 4 KB)</a>
      <a class="btn btn-ghost" href="${CSV}" download>Or download as CSV</a>
    </div>
    <p style="font-size:14px;color:#6b7280">The Excel file opens directly in Excel, LibreOffice and
      Numbers, and in Google Sheets via <em>File → Import → Upload</em>. Take the CSV instead if you
      are importing it into something else — but note that on a European system locale Excel splits
      a CSV on <code>;</code> rather than <code>,</code>, so the .xlsx is the one that will simply
      open.</p>

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
      down whether a late cancellation uses a session.
      <a href="/guides/cancellation-policy">Decide it once</a>, put it in Notes,
      and say it when they buy. We go through the options in
      <a href="/guides/session-packages">tracking packages and remaining sessions</a>.</p>

    <h2>Before the tracking, the price</h2>
    <p>The sheet records what a client bought. Deciding what a block should cost in the first
      place — once the prep, travel and messages around each session are counted — is a different
      question, and the <a href="/personal-trainer-pricing-calculator">pricing calculator</a> does
      that arithmetic. Also free, also no sign-up.</p>

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
      <a class="card" href="/guides/cancellation-policy">
        <h3>Writing a cancellation policy that holds</h3>
        <p>The one column in this sheet that needs a decision behind it.</p>
      </a>
    </div>`,
  });
}

/* 7 ── /guides/cancellation-policy ────────────────────────────────────────── */
{
  const path = '/guides/cancellation-policy';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'Cancellation policy', path },
  ];
  const title = 'Personal Trainer Cancellation Policy | TRENIKO';
  const description =
    'A policy is only worth having if you apply it the same way every time. The four things yours has to decide, and where the 24-hour rule quietly breaks.';

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
          headline: 'How to write a personal trainer cancellation policy that holds',
          description,
          url: `${ORIGIN}${path}`,
          inLanguage: 'en',
          publisher: { '@id': `${ORIGIN}/#organization` },
          isPartOf: { '@id': `${ORIGIN}/#website` },
        },
      ],
    },
    body: `    <p class="eyebrow">Guides</p>
    <h1>How to write a cancellation policy that actually holds</h1>
    <p class="lede">Most trainers have a cancellation policy. Far fewer have one they apply the
      same way twice, and that is the whole problem — an unevenly enforced policy is worse than no
      policy, because it teaches every client that the rule is negotiable and that negotiating is
      how you get out of it.</p>

    <h2>The problem is not the policy. It is the second exception.</h2>
    <p>Nobody struggles with the first cancellation. A client's child is ill on a Tuesday, you
      waive the session, and that is obviously right.</p>
    <p>The difficulty starts at the second one, for a less sympathetic reason, from a client you
      like. You now have to either apply a rule you did not apply last time, or waive again and
      accept that the rule does not exist. Both feel bad, which is why most trainers do neither
      and simply avoid the conversation.</p>
    <p>A policy is not there to extract money from people. It is there so that you have already
      made this decision once, calmly, in advance — instead of making it badly, forty times, under
      social pressure, in a doorway.</p>

    <h2>The four things a policy has to decide</h2>
    <p>Everything else is wording. These four are the substance.</p>
    <ol>
      <li><strong>The notice period.</strong> How much warning counts as a cancellation rather
        than a late cancellation. Twenty-four hours is the convention.</li>
      <li><strong>What happens to the session.</strong> This is the one people leave vague. Inside
        the notice period: is the session returned to the package, or is it used? Say which.</li>
      <li><strong>What the exceptions are.</strong> Illness, bereavement, an injury you asked them
        to rest. Naming them in advance is what makes the rest of the policy enforceable, because
        it turns "you are being harsh" into "this is not one of the listed cases".</li>
      <li><strong>How many exceptions.</strong> The unpopular one. "Illness is always waived" is
        not a policy — it is an instruction on what to say. A number ("two waived cancellations
        per package") is a policy.</li>
    </ol>

    <h2>Where the 24-hour rule quietly breaks</h2>
    <p>Twenty-four hours is a sensible default and it fails in three specific places. All three are
      predictable, so decide them now rather than at 06:40 on a Monday.</p>
    <ul>
      <li><strong>The early-morning session.</strong> A 07:00 Tuesday slot has to be cancelled by
        07:00 Monday — which is before most people know they are ill. If half your book is early
        mornings, an evening deadline ("by 20:00 the night before") is more honest and easier to
        hold.</li>
      <li><strong>The Monday session.</strong> Twenty-four hours' notice means cancelling on a
        Sunday, which is exactly when you are least likely to see the message and most likely to
        be annoyed by it. Decide whether your notice window even runs on the weekend.</li>
      <li><strong>The client who cancels at 25 hours, every time.</strong> Technically compliant,
        and it still empties your week. This is not a policy problem — it is a schedule problem,
        and the fix is the standing-slot conversation, not a stricter rule.</li>
    </ul>

    <h2>Three policies that actually work</h2>
    <p>These are the three shapes worth choosing between. There is no universally correct one; the
      right answer depends on whether your calendar is full.</p>
    <h3>Strict — the session is used</h3>
    <p>Inside the notice period, the session is deducted from the package. Simple, unambiguous, and
      the only one that genuinely protects your income when a full calendar means you had to turn
      someone away for that slot.</p>
    <p><em>Costs you:</em> it is the hardest to say out loud, and it will occasionally cost you a
      client who was on the fence anyway.</p>
    <h3>Moderate — one rescheduled, then used</h3>
    <p>The first late cancellation in a package can be moved to another slot that same week. After
      that, the session is used. This is the policy most independent trainers converge on, because
      it forgives genuine life events without becoming a standing option.</p>
    <p><em>Costs you:</em> more admin. You have to actually track which client has used their
      reschedule, which is a small thing to track and an easy one to lose.</p>
    <h3>Relational — waived, but counted and discussed</h3>
    <p>Late cancellations are waived, and recorded. When the record shows three in a block of ten,
      you have a conversation about whether the time slot is right — not about money.</p>
    <p><em>Costs you:</em> real money if your calendar is full, and it only works at all if you
      genuinely keep the record. Waiving without counting is not this policy; it is not having one.</p>

    <h2>Say it once, in writing, before it is needed</h2>
    <p>The policy has to reach the client at the moment they buy the package, not at the moment
      they break it. A rule that first appears in an argument reads as invented on the spot, even
      when it is not.</p>
    <p>In practice that means it goes in the same message as the package price, in plain words,
      and it stays somewhere the client can look it up. Three sentences is enough:</p>
    <div class="note">
      <span class="label">Example</span>
      <p>Sessions cancelled with more than 24 hours' notice go back into your package and we
        rebook them. Inside 24 hours, the first one in each block I will move if we can find a slot
        that week; after that the session is used. Illness and injury are always waived —
        just tell me.</p>
    </div>
    <p>That is a complete policy. It decides the notice period, what happens to the session, the
      exception, and the limit on the exception.</p>

    <h2>Enforcing it without becoming the villain</h2>
    <p>The reason enforcement feels confrontational is that it usually happens as a reaction. It
      does not have to. Two habits remove almost all of the friction:</p>
    <ul>
      <li><strong>State the outcome, not the judgement.</strong> "That one comes out of the block,
        so you have four left" is a fact about a number. "You cancelled too late" is a verdict
        about a person. Same decision, entirely different conversation.</li>
      <li><strong>Send it in writing, the same day, every time.</strong> Not as evidence — as
        arithmetic. The dispute you are avoiding is not about the policy; it is about the count
        three weeks later, when nobody remembers which sessions happened.</li>
    </ul>

    <h2>Record the cancellation as a cancellation</h2>
    <p>This is where a policy usually leaks. The session did not happen, so it gets deleted from
      the calendar — and now the record shows a client who trained nine times when they were
      billed for ten, with nothing anywhere explaining the difference.</p>
    <p>A cancelled session is a fact worth keeping. Keep three states, not two: <strong>completed</strong>,
      <strong>cancelled</strong> and <strong>no-show</strong>. They have different consequences for
      the package and they mean different things about the client. A system that only stores what
      was booked will always disagree with what happened. That is the same argument, at more
      length, in <a href="/guides/session-packages">tracking packages and remaining sessions</a>.</p>
    <p>A no-show is not a late cancellation and should not be handled as one —
      <a href="/guides/no-show-clients">what to do when a client does not turn up</a> covers that
      case on its own.</p>
${cta('TRENIKO records each session as completed, cancelled or no-show, and the package count follows from that rather than from memory — so applying your policy is a choice you make once, not arithmetic you redo later.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/guides/no-show-clients">
        <h3>When a client does not show up</h3>
        <p>Why a no-show is a different fact from a cancellation, and what to do the same day.</p>
      </a>
      <a class="card" href="/guides/session-packages">
        <h3>Tracking packages and remaining sessions</h3>
        <p>Why the count drifts, and the rule that keeps it honest.</p>
      </a>
      <a class="card" href="/free-personal-trainer-client-tracker">
        <h3>Free client &amp; session tracker</h3>
        <p>A spreadsheet with cancellations and no-shows already in the model. No sign-up.</p>
      </a>
    </div>`,
  });
}

/* 8 ── /guides/no-show-clients ────────────────────────────────────────────── */
{
  const path = '/guides/no-show-clients';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'No-shows', path },
  ];
  const title = 'When a Personal Training Client Does Not Show Up | TRENIKO';
  const description =
    'A no-show is a different fact from a cancellation, and recording them alike is what makes your session count wrong. What to do, and what a second one means.';

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
          headline: 'What to do when a personal training client does not show up',
          description,
          url: `${ORIGIN}${path}`,
          inLanguage: 'en',
          publisher: { '@id': `${ORIGIN}/#organization` },
          isPartOf: { '@id': `${ORIGIN}/#website` },
        },
      ],
    },
    body: `    <p class="eyebrow">Guides</p>
    <h1>When a client does not show up</h1>
    <p class="lede">You are in the gym, the slot has started, and nobody has arrived or sent
      anything. There are three separate decisions inside the next hour, and most of the damage
      comes from making the third one — what the record says — without thinking about it at all.</p>

    <h2>A no-show is not a late cancellation</h2>
    <p>These get treated as the same event because they have the same immediate effect: an empty
      hour. They are not the same fact, and collapsing them is what makes your numbers wrong later.</p>
    <div class="table-scroll">
    <table>
      <thead><tr><th>Event</th><th>What happened</th><th>What it tells you</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Cancellation</strong></td>
          <td>Client gave notice, inside your window or outside it</td>
          <td>Something came up. Usually nothing</td>
        </tr>
        <tr>
          <td><strong>Late cancellation</strong></td>
          <td>Notice arrived, too late to fill the slot</td>
          <td>Usually nothing. Repeatedly: the slot is wrong</td>
        </tr>
        <tr>
          <td><strong>No-show</strong></td>
          <td>No notice at all</td>
          <td>Something else. This one is a signal</td>
        </tr>
      </tbody>
    </table>
    </div>
    <p>A late cancellation is a scheduling failure. A no-show is usually a <em>relationship</em>
      failure — the client did not feel able to tell you, or had already privately stopped. Those
      need different responses, and you cannot give different responses to two things you recorded
      identically.</p>

    <h2>The first fifteen minutes</h2>
    <p>Keep this boring and identical every time, so it never reads as annoyance.</p>
    <ol>
      <li><strong>Wait ten to fifteen minutes.</strong> Decide the number once and stick to it. A
        client stuck in traffic who arrives at minute twelve to find you gone is a much bigger
        problem than a wasted quarter of an hour.</li>
      <li><strong>Send one short message.</strong> "Hey — we were down for 18:00 today, everything
        okay?" That is it. No mention of the policy, no invoice, nothing that requires them to
        defend themselves before you know what happened.</li>
      <li><strong>Then leave.</strong> Do not sit on it for the full hour. The slot is gone.</li>
    </ol>
    <p>The message is doing real work: roughly half the time the answer is a genuine emergency or
      a diary mistake, and asking first is the difference between a client who apologises and a
      client who is embarrassed and quietly stops booking.</p>

    <h2>Does it use a session?</h2>
    <p>In almost every workable policy, <strong>yes</strong> — and this is the case where being
      strict is easiest to justify, because the trainer showed up and the time cannot be recovered.</p>
    <p>Two qualifications worth building in from the start:</p>
    <ul>
      <li><strong>Charge it, then decide whether to waive it.</strong> Deduct the session as a
        matter of routine, and waive it deliberately when the reason warrants. That ordering
        matters: the default has to be the rule, or the rule is the exception.</li>
      <li><strong>A first no-show from a long-standing client is usually a mistake, not a pattern.</strong>
        Waiving it costs you one session and buys a lot of goodwill. Waiving the third costs you a
        client, slowly, because it tells them the appointment is not real.</li>
    </ul>
    <p>Where this fits into the wider set of rules is in
      <a href="/guides/cancellation-policy">writing a cancellation policy that holds</a> — a
      no-show clause belongs in the same three sentences as everything else.</p>

    <h2>The second no-show is the one that matters</h2>
    <p>One is noise. Two from the same client, within a block, is information, and it is almost
      never about you. The usual causes, in rough order of how often they turn out to be the
      answer:</p>
    <ul>
      <li><strong>The time slot stopped working</strong> and they have not wanted to ask to move
        it. This is the most common and the easiest to fix.</li>
      <li><strong>The sessions have stopped feeling worth it</strong> — often after a plateau, or
        after a goal was quietly reached and never replaced.</li>
      <li><strong>Money.</strong> The next package is due and they cannot say so.</li>
      <li><strong>They have decided to stop</strong> and are avoiding the conversation.</li>
    </ul>
    <p>All four are recoverable, and none of them are recoverable by sending a firmer reminder. The
      conversation that works is a direct, unbothered one: <em>"I have noticed the last couple have
      not happened — is this slot still the right one for you?"</em> It offers them a way to say
      the real thing.</p>
    <p>The reason to keep a per-client record at all is that you will not spot the second one
      otherwise. Across fifteen clients, two missed sessions six weeks apart do not feel like a
      pattern — they feel like two ordinary weeks. What to keep, and what not to bother with, is
      in <a href="/guides/client-management">managing personal training clients</a>.</p>

    <h2>Record it as a no-show, not as a deletion</h2>
    <p>The instinct is to delete the session from the calendar, because it did not happen. Do not.
      Once it is deleted, three facts are gone at once: that you were there, that the session was
      deducted, and that this client has now missed two.</p>
    <p>Keep the session, mark its outcome. The count and the pattern both come out of that record
      for free, and neither can be reconstructed later from memory.</p>

    <h2>Reducing them, honestly</h2>
    <p>Most advice here overpromises. Three things genuinely help, and none of them are software:</p>
    <ul>
      <li><strong>A standing slot.</strong> Same time, same days, every week. Sessions that are
        rebooked ad hoc are the ones that get forgotten, because they never became a habit.</li>
      <li><strong>Booking the next one before they leave.</strong> The end of the session is the
        only moment when the client is definitely thinking about training.</li>
      <li><strong>One reminder, the evening before.</strong> Enough to catch a diary mistake, not
        so much that it becomes something they stop reading.</li>
    </ul>
    <p>What does not help: escalating penalties, longer notice periods, or a more detailed policy.
      Those address a compliance problem, and no-shows are usually not one.</p>
${cta('TRENIKO stores completed, cancelled and no-show as distinct outcomes on the session — so the package count is right without you doing arithmetic, and a second miss is visible on the client record rather than in your memory.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/guides/cancellation-policy">
        <h3>Writing a cancellation policy that holds</h3>
        <p>The four things it has to decide, and where the 24-hour rule breaks.</p>
      </a>
      <a class="card" href="/guides/client-management">
        <h3>Managing personal training clients</h3>
        <p>What to record per client, and the review habit that surfaces patterns early.</p>
      </a>
      <a class="card" href="/guides/session-packages">
        <h3>Tracking packages and remaining sessions</h3>
        <p>Why the count drifts, and what a package actually needs to store.</p>
      </a>
    </div>`,
  });
}

/* 9 ── /guides/pricing-personal-training-packages ─────────────────────────── */
{
  const path = '/guides/pricing-personal-training-packages';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'Pricing packages', path },
  ];
  const title = 'How to Price Personal Training Packages | TRENIKO';
  const description =
    'Going from an hourly rate to a package price without discounting yourself into a worse business. The unpaid hours to count, and what a discount really buys.';

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
          headline: 'How to price personal training packages',
          description,
          url: `${ORIGIN}${path}`,
          inLanguage: 'en',
          publisher: { '@id': `${ORIGIN}/#organization` },
          isPartOf: { '@id': `${ORIGIN}/#website` },
        },
      ],
    },
    body: `    <p class="eyebrow">Guides</p>
    <h1>How to price personal training packages</h1>
    <p class="lede">This page contains no recommended prices. What a session is worth depends on
      your city, your market and your experience, and any article that gives you a number is
      guessing about all three. What it does contain is the arithmetic — because the mistake that
      costs trainers the most money is not pricing too low, it is not knowing what the current
      price already is.</p>

    <h2>First: an hour of training is not an hour of work</h2>
    <p>Almost every package is priced off a session rate, and almost every session rate is set as
      though the session is the whole job. Before you discount anything, count what one session
      actually consumes:</p>
    <ul>
      <li>The session itself.</li>
      <li>Programming and adjusting it, whether that is ten minutes or thirty.</li>
      <li>Travel and setup, if you move between gyms or go to clients.</li>
      <li>The messages. Every trainer underestimates this one, and it is not optional work — it is
        a large part of what the client is actually buying.</li>
      <li>The share of admin, invoicing and chasing that this client causes.</li>
    </ul>
    <p>Add those up honestly for one client for one week and divide by the sessions delivered.
      That number — not your headline rate — is what you are really being paid per hour of work,
      and it is the number a package discount comes out of.</p>
    <p>If you would rather not do that by hand, the
      <a href="/personal-trainer-pricing-calculator">pricing calculator</a> does exactly this
      arithmetic and the package side of it. It suggests no prices — it only works on what you
      type.</p>
    <p>Do this before anything else on this page. Everything after it is a decision about that
      figure, and you cannot make those decisions without it.</p>

    <h2>What a package discount actually buys</h2>
    <p>A package is a discount in exchange for something. If you cannot name the something, you
      have not made a pricing decision — you have lowered your price. There are three things worth
      buying, and they are not equally valuable:</p>
    <ol>
      <li><strong>Cash up front.</strong> Genuinely valuable and the most commonly undervalued.
        Ten sessions paid today is your rent covered and no chasing. This alone justifies a
        discount.</li>
      <li><strong>Commitment.</strong> Somewhat real. A client who has paid for ten shows up more
        reliably than one paying per session — but the effect fades as the block runs down.</li>
      <li><strong>Less admin.</strong> Real, and small. One payment instead of ten is perhaps
        twenty minutes saved.</li>
    </ol>
    <p>Now the uncomfortable version of the same point: <strong>if a client would have booked ten
      sessions anyway, one at a time, the discount bought you nothing except the cash-flow benefit.</strong>
      That is why blanket "10% off everything over ten sessions" pricing quietly leaks money — it
      pays a discount to your most committed clients, who were the ones least in need of
      persuading.</p>

    <h2>Three structures, and what each is actually for</h2>
    <h3>Blocks of sessions</h3>
    <p>Buy ten, use them as you like. The default, and the easiest for a client to understand.</p>
    <p><em>The catch:</em> without an expiry, a block is an open-ended liability. A client who buys
      ten in March and has four left in November is holding sessions priced at last year's rate,
      and you have already spent the money.</p>
    <h3>Monthly — a fixed number of sessions per month</h3>
    <p>Eight sessions a month, charged monthly, recurring. Predictable income, no repeated selling,
      no expiry problem because the month is the expiry.</p>
    <p><em>The catch:</em> you have to decide what happens to unused sessions at month end before
      the first month ends. Roll over one month only, or none — but decide it in advance, in
      writing, because deciding it retrospectively always looks like a rule you invented.</p>
    <h3>Hybrid — a monthly base with extras at a session rate</h3>
    <p>Four sessions a month included, additional ones at the standard rate. Suits clients whose
      availability genuinely varies.</p>
    <p><em>The catch:</em> it is the hardest to track and the easiest to get wrong. If you cannot
      answer "how many has she used this month?" instantly, this structure will cost you more in
      errors than it earns in flexibility.</p>

    <h2>Expiry dates: necessary, and easy to do unfairly</h2>
    <p>An expiry is not a trick to void sessions. It exists so that a price stays attached to a
      time period, and so that a package does not become an indefinite obligation at an old rate.
      Two rules keep it fair:</p>
    <ul>
      <li><strong>Set it from the training frequency, not from the calendar.</strong> Ten sessions
        for a client training twice a week is about five weeks of work — a three-month expiry is
        generous. The same ten for someone training fortnightly is five months, and a three-month
        expiry is a trap.</li>
      <li><strong>Say it at the point of sale, in the same message as the price.</strong> An expiry
        the client learns about when it expires will cost you the client, and it should.</li>
    </ul>
    <p>Then actually track it. An expiry you do not enforce is not a policy, and an expiry you
      enforce inconsistently is worse than none — the same argument as in
      <a href="/guides/cancellation-policy">writing a cancellation policy</a>.</p>

    <h2>Three mistakes worth naming</h2>
    <ol>
      <li><strong>Discounting to close a client who was already sold.</strong> If the discount
        appears after they have said yes, you paid for nothing.</li>
      <li><strong>Selling a bigger block than the client can realistically use.</strong> Twenty
        sessions to someone training once a week is nine months of obligation and a near-certain
        expiry argument. A block should be finishable.</li>
      <li><strong>Never raising the price.</strong> Not a pricing decision so much as an avoided
        conversation. The workable version: new clients get the new rate immediately, existing
        clients keep the old rate to the end of their current package and are told, once, in
        advance, what the next one costs.</li>
    </ol>

    <h2>The number you need before any of this</h2>
    <p>Every decision on this page needs one fact you can get to instantly: <strong>how many
      sessions each client has left, and whether those sessions are paid for.</strong> Without it,
      you cannot see which packages are about to run out, cannot time a renewal conversation, and
      cannot tell whether a discount is working.</p>
    <p>That is a tracking problem before it is a pricing problem, and it is covered properly in
      <a href="/guides/session-packages">tracking packages and remaining sessions</a>.</p>
${cta('TRENIKO holds each package with its price, its session count and its expiry, counts down as sessions are completed, and flags a package before it runs out — which is when the renewal conversation is worth having rather than after.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/guides/session-packages">
        <h3>Tracking packages and remaining sessions</h3>
        <p>What a package needs to store, and why the count drifts.</p>
      </a>
      <a class="card" href="/guides/cancellation-policy">
        <h3>Writing a cancellation policy that holds</h3>
        <p>The four decisions, and how to enforce them without the confrontation.</p>
      </a>
      <a class="card" href="/free-personal-trainer-client-tracker">
        <h3>Free client &amp; session tracker</h3>
        <p>Package price, sessions used and sessions left, in one sheet. No sign-up.</p>
      </a>
    </div>`,
  });
}

/* 10 ── /guides/new-client-first-week ─────────────────────────────────────── */
{
  const path = '/guides/new-client-first-week';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'A new client’s first week', path },
  ];
  const title = 'A New Personal Training Client’s First Week | TRENIKO';
  const description =
    'An onboarding order that stops you chasing paperwork in week four: what to have before session one, and the baseline you cannot go back and record later.';

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
          headline: 'A new personal training client’s first week',
          description,
          url: `${ORIGIN}${path}`,
          inLanguage: 'en',
          publisher: { '@id': `${ORIGIN}/#organization` },
          isPartOf: { '@id': `${ORIGIN}/#website` },
        },
      ],
    },
    body: `    <p class="eyebrow">Guides</p>
    <h1>A new client’s first week</h1>
    <p class="lede">Onboarding a client is not a form. It is a small number of facts, collected in
      an order that matters — because anything not captured in the first week is something you will
      be chasing in week four, when asking looks like disorganisation rather than diligence.</p>
    <p>This is deliberately short. A long onboarding process is one you will abandon by the third
      client.</p>

    <h2>Before session one</h2>
    <p>Four things, and none of them take place in the gym.</p>
    <ol>
      <li><strong>Health screening.</strong> Whatever your certifying body requires — a PAR-Q or
        equivalent — plus current injuries, medications relevant to exercise, and anything a
        doctor has told them to avoid. This is not administrative. It changes what you are allowed
        to program in the session you are about to run, so it cannot happen afterwards.</li>
      <li><strong>The goal, in their words.</strong> Write down the sentence they said, not your
        translation of it. "I want to not be out of breath on the stairs at work" is a usable goal
        with a built-in test. "Improve cardiovascular fitness" is your paraphrase, and it has
        quietly discarded the only part you could check in eight weeks.</li>
      <li><strong>What they have already tried.</strong> One line. A client who has done six months
        of a bootcamp and stopped is a different starting point from one who has never trained, and
        the thing that made them stop is usually the thing that will make them stop again.</li>
      <li><strong>The commercial part, agreed in writing.</strong> Price, package size, expiry if
        there is one, and the cancellation policy. All in the same message. Sorting this out before
        the first session takes two minutes; after it, it is a conversation about money with
        someone you have just trained.</li>
    </ol>

    <h2>Session one: capture the baseline you cannot go back for</h2>
    <p>Session one is the only session where you can record a genuine "before". Miss it and it is
      gone — three weeks later they have already improved, and you will never know by how much.</p>
    <ul>
      <li><strong>Two or three measurements, chosen because you will repeat them.</strong> Not
        every metric you know how to take. Whatever you record here, you are committing to
        recording every six to eight weeks; five measurements you keep beat twelve you do once.</li>
      <li><strong>A movement baseline.</strong> How they squat, hinge, push and pull today, in a
        sentence each. This is what makes progress visible for the many clients whose weight will
        not move much and who need something honest to look at.</li>
      <li><strong>A starting load or time on two or three lifts.</strong> The most motivating record
        you will ever show a client, and it costs nothing to write down.</li>
    </ul>
    <p>Which measurements are worth keeping — and which are simply data you will never look at —
      is covered in <a href="/guides/client-management">managing personal training clients</a>.</p>

    <h2>By the end of the first week</h2>
    <ul>
      <li><strong>The standing slot is agreed.</strong> Same time, same days. Clients whose
        sessions are rebooked one at a time are the ones who quietly drift, and the drift shows up
        first as a <a href="/guides/no-show-clients">missed session</a>.</li>
      <li><strong>The package is recorded, with what has been paid against it.</strong> Not "she
        bought ten" in your head. Ten sessions, this price, paid on this date, this many used —
        because week one is the only time this is effortless to record correctly.</li>
      <li><strong>A review date is in the diary.</strong> Six to eight weeks out, booked now. A
        review that is scheduled at the start is a normal part of the service; one arranged later,
        after things have gone quiet, reads as a rescue attempt.</li>
    </ul>

    <h2>What not to collect</h2>
    <p>Onboarding processes fail by being too long, so it is worth being explicit about what to
      leave out:</p>
    <ul>
      <li><strong>Anything you will not act on.</strong> A detailed nutrition history you have no
        intention of coaching on is an intrusive question with no purpose.</li>
      <li><strong>Personal data you have no reason to hold.</strong> Under GDPR you need a reason
        for each field, and "it was on the template" is not one. Less stored is less to protect,
        less to explain, and less to delete when they ask.</li>
      <li><strong>A twelve-week plan written in advance.</strong> You do not yet know how they
        respond to training. Write week one properly and decide week two afterwards.</li>
    </ul>

    <h2>Why the order is the whole point</h2>
    <p>Every item above is one you would eventually collect anyway. The difference is that in week
      one the client expects to be asked and answers immediately, whereas in week four the same
      question makes you look like you lost something — and by week eight the honest answer is that
      you did.</p>
    <p>None of this needs software. It needs one place per client where those facts live, so the
      next session starts from the record instead of from memory. A spreadsheet does this perfectly
      well until the counting starts —
      <a href="/guides/software-vs-spreadsheets">software vs spreadsheets</a> is the honest version
      of where that line falls.</p>
${cta('In TRENIKO a client record holds the goal, the notes, the measurements, the sessions and the package together — so the first week is entered once and the eighth week starts from it.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/guides/client-management">
        <h3>Managing personal training clients</h3>
        <p>What to record per client, what to leave out, and the review habit.</p>
      </a>
      <a class="card" href="/guides/pricing-personal-training-packages">
        <h3>Pricing personal training packages</h3>
        <p>The unpaid hours to count first, and what a discount actually buys.</p>
      </a>
      <a class="card" href="/guides/cancellation-policy">
        <h3>Writing a cancellation policy that holds</h3>
        <p>Agree it in week one, in the same message as the price.</p>
      </a>
    </div>`,
  });
}

/* 11 ── /personal-trainer-client-management-software ──────────────────────── */
{
  const path = '/personal-trainer-client-management-software';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Client management software', path },
  ];
  const title = 'Client Management Software for Personal Trainers | TRENIKO';
  const description =
    'Judged by the five questions it has to answer instantly: why gym systems fail solo trainers, and what to check before you commit your clients to one.';

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
    body: `    <p class="eyebrow">Client management software</p>
    <h1>Personal trainer client management software: what it has to do</h1>
    <p class="lede">"Client management" is a phrase borrowed from sales software, and the borrowing
      causes the confusion. A sales CRM is built to move strangers toward a purchase. A personal
      trainer already knows their clients, has already sold to them, and needs something quite
      different: a place where the operational truth about each person is current and in one piece.</p>

    <h2>What a trainer means by client management</h2>
    <p>Not a pipeline. Not lead scoring. One record per client that holds, without you
      reconstructing it:</p>
    <ul>
      <li>Who they are, and how to reach them.</li>
      <li>What they are training for, in their own words, and what they have already tried.</li>
      <li>Health information that constrains what you can program.</li>
      <li>Every session — including the ones that did not happen, and why.</li>
      <li>What they bought, what they paid, and how much of it is left.</li>
      <li>What has measurably changed since they started.</li>
    </ul>
    <p>That list is not ambitious. You already hold all of it. The difference software makes is
      that it stops being six records in six places that only you know how to reconcile.</p>

    <h2>The five questions it has to answer instantly</h2>
    <p>This is a more useful test than any feature list, because it is what you are actually
      interrupted with during a working day. If a system cannot answer these in seconds, it is
      storage, not management.</p>
    <ol>
      <li><strong>How many sessions has this client got left?</strong> The single most-asked
        question in the business, and the one most often answered by counting backwards through a
        calendar.</li>
      <li><strong>Has she paid for them?</strong> A different question from the first, and the two
        disagree more often than anyone expects.</li>
      <li><strong>Whose package runs out in the next two weeks?</strong> Nobody can answer this
        client-by-client. It has to be a list the system produces, or the renewal conversation
        happens too late.</li>
      <li><strong>Who has not trained in three weeks?</strong> The earliest reliable signal that
        you are about to lose someone, and the one that is invisible unless something is watching
        for it.</li>
      <li><strong>What did we do last time, and what did she say about it?</strong> The question
        that makes a session start from the record instead of from memory.</li>
    </ol>
    <p>Questions 3 and 4 are the ones that separate real management software from a tidy list. Both
      require the system to tell you something you did not ask for.</p>

    <h2>Why gym software usually fails a solo trainer</h2>
    <p>Most fitness software was built for facilities, then sold to individuals. That origin shows
      up as work you have to do before you get any value:</p>
    <ul>
      <li><strong>Membership billing you do not need.</strong> Recurring dues, freezes, pro-rata
        joining fees — a model for a facility, not for someone selling blocks of ten.</li>
      <li><strong>Staff, rooms and resources</strong> to configure when the staff is you and the
        room is a corner of somebody else's gym.</li>
      <li><strong>A class-booking portal</strong> that has to be branded and set up before it does
        anything, for classes you may not run.</li>
      <li><strong>Setup measured in evenings.</strong> The genuine cost of most of this category is
        not the monthly fee, it is that you never finish the configuration and so never get the
        benefit.</li>
    </ul>
    <p>The opposite failure is just as common: a workout-programming app that builds excellent
      training plans and has no idea what anyone paid.</p>

    <h2>What to check before you commit your data</h2>
    <p>Six checks, in the order they matter — the fuller version is in
      <a href="/personal-trainer-software">what to look for in personal trainer software</a>.</p>
    <ol>
      <li><strong>Time to first client.</strong> If you cannot add a real client and book a real
        session in the first ten minutes, the odds you finish setting it up are poor.</li>
      <li><strong>Does the package count down by itself?</strong> If you still tally by hand, the
        most error-prone job in the business is unchanged and you have added a second place to
        keep it.</li>
      <li><strong>Does it warn you before a package runs out?</strong> Being told is the whole
        value. Being able to look it up is not the same feature.</li>
      <li><strong>Are payments attached to the sessions they cover?</strong> Separated, you are
        reconciling two lists again.</li>
      <li><strong>Can it record what happened, not only what was booked?</strong> Completed,
        cancelled and no-show are different facts with different consequences — see
        <a href="/guides/no-show-clients">when a client does not show up</a>.</li>
      <li><strong>Can you export everything, and delete the account?</strong> Ask on day one. The
        day you want to leave is the wrong day to find out.</li>
    </ol>

    <h2>For solo and independent trainers specifically</h2>
    <p>If you are the coach, the receptionist and the bookkeeper, two constraints dominate every
      other consideration. <strong>Nothing may require configuration before it is useful</strong>,
      because there is no admin day in your week to do it on. And <strong>the system has to be
      usable standing up, on a phone, between sessions</strong> — anything that only works properly
      at a desk in the evening will be updated in batches, and a record updated in batches is out
      of date exactly when you need it.</p>
    <p>Those two constraints are why "smaller version of gym software" rarely works, and why the
      honest alternative for many trainers is a spreadsheet.
      <a href="/guides/software-vs-spreadsheets">Software vs spreadsheets</a> covers where that
      line genuinely falls, including the cases where the spreadsheet wins.</p>

    <h2>Where TRENIKO fits, and where it does not</h2>
    <p>TRENIKO is built for the trainer who is also the business. One record per client with goals,
      notes and history. Sessions recorded as completed, cancelled or no-show. Packages that count
      down as sessions happen and flag before they run out. Payments held against the sessions they
      cover. Progress measurements over time. Training plans from your own exercise library.</p>
    <p>It is not for gyms. There is no membership billing, no front desk, no room booking and no
      class portal — not as a roadmap item, as a decision. If you need those, a facility system is
      the right answer and TRENIKO will frustrate you.</p>
    <p>It is early, and this site says so rather than quoting customer numbers that do not exist
      yet.</p>
${cta('The fastest way to judge it is with a client you actually have. Adding one, booking a session and recording a package takes a few minutes — enough to tell whether it matches how you work.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/personal-trainer-software">
        <h3>What to look for in personal trainer software</h3>
        <p>The six checks in full, and how to tell when you do not need any of it yet.</p>
      </a>
      <a class="card" href="/guides/client-management">
        <h3>Managing personal training clients</h3>
        <p>What to record per client, independent of any tool.</p>
      </a>
      <a class="card" href="/free-personal-trainer-client-tracker">
        <h3>Free client &amp; session tracker</h3>
        <p>Start with a spreadsheet that already counts sessions down. No sign-up.</p>
      </a>
    </div>`,
  });
}

/* 12 ── /personal-trainer-pricing-calculator ──────────────────────────────── */
{
  const path = '/personal-trainer-pricing-calculator';
  const crumbs = [
    { name: 'TRENIKO', path: '/' },
    { name: 'Pricing calculator', path },
  ];
  const title = 'Personal Trainer Pricing Calculator (Free, No Sign-up) | TRENIKO';
  const description =
    'Work out what an hour of coaching really pays once prep, travel and messages are counted, and what a package discount actually costs. Free, no sign-up.';

  /**
   * The arithmetic, as a separate file.
   *
   * It calculates only from what the visitor types. There are no benchmark
   * rates, no "average trainer earns" figures and no suggested prices anywhere
   * in it, because those numbers vary by city and market and TRENIKO has not
   * measured them. A calculator that invented one would be worse than useless:
   * it would be confidently wrong about somebody's income.
   *
   * Everything happens in the browser. Nothing is sent anywhere, nothing is
   * stored, and the page works with the network disconnected after load.
   */
  const CALC = `(function () {
  'use strict';

  var ids = ['rate', 'length', 'prep', 'travel', 'messaging', 'admin', 'blockSize', 'discount'];
  var el = {};
  ids.forEach(function (id) { el[id] = document.getElementById(id); });
  var out = document.getElementById('results');
  if (!out || ids.some(function (id) { return !el[id]; })) return;

  function num(node) {
    var v = parseFloat(String(node.value).replace(',', '.'));
    return isFinite(v) && v >= 0 ? v : 0;
  }

  // Money is formatted without a currency symbol on purpose: the trainer's
  // currency is unknown, and guessing one would put a wrong unit on every
  // figure. The page says "in your currency" once, next to the first input.
  function money(v) {
    return (Math.round(v * 100) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function calc() {
    var rate = num(el.rate);
    var minutes = num(el.length) + num(el.prep) + num(el.travel) + num(el.messaging) + num(el.admin);
    var hours = minutes / 60;
    var realHourly = hours > 0 ? rate / hours : 0;

    var block = Math.max(1, Math.round(num(el.blockSize)));
    var discount = Math.min(100, num(el.discount));
    var listTotal = rate * block;
    var packageTotal = listTotal * (1 - discount / 100);
    var perSession = block > 0 ? packageTotal / block : 0;
    var given = listTotal - packageTotal;
    var packageHourly = hours > 0 ? perSession / hours : 0;

    var rows = [
      ['Time you actually spend per session',
       minutes + ' min' + (minutes !== 60 ? ' (' + (Math.round(hours * 100) / 100) + ' h)' : ''),
       'The session plus everything around it.'],
      ['What that hour really pays', money(realHourly) + ' / hour',
       'Your headline rate divided by the time the session actually costs you.'],
      ['Block of ' + block + ' at list price', money(listTotal), ''],
      ['Block of ' + block + ' at ' + (Math.round(discount * 10) / 10) + '% off', money(packageTotal),
       'Per session: ' + money(perSession)],
      ['What the discount gives away', money(given),
       given > 0 ? 'Over the block. Ask what it buys — cash up front, or commitment.' : 'No discount applied.'],
      ['Real hourly rate inside the package', money(packageHourly) + ' / hour',
       'This is the number to compare against what you would accept.']
    ];

    var html = '<div class="table-scroll"><table><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + r[0] + '</td><td><strong>' + r[1] + '</strong>' +
              (r[2] ? '<br><span style="color:#6b7280;font-size:14px">' + r[2] + '</span>' : '') +
              '</td></tr>';
    });
    html += '</tbody></table></div>';

    if (rate > 0 && minutes > num(el.length)) {
      var lost = rate - realHourly;
      if (lost > 0.005) {
        html += '<p style="margin-top:14px">Charging ' + money(rate) +
          ' for the session but spending ' + minutes + ' minutes on it means the unpaid ' +
          (minutes - num(el.length)) + ' minutes cost you ' + money(lost) +
          ' of every hour. That is not an argument for charging more — it is the number to know ' +
          'before you agree to a discount on top of it.</p>';
      }
    }

    out.innerHTML = html;
  }

  ids.forEach(function (id) {
    el[id].addEventListener('input', calc);
    el[id].addEventListener('change', calc);
  });
  calc();
})();
`;

  const script = emitScript('calculator', CALC);

  PAGES.push({
    path,
    title,
    description,
    script,
    crumbs,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumb(crumbs),
        ORG,
        {
          // A genuinely free browser tool, described as one. No price, no
          // rating, no review — there are none to describe.
          '@type': 'WebApplication',
          '@id': `${ORIGIN}${path}#app`,
          name: 'Personal trainer pricing calculator',
          url: `${ORIGIN}${path}`,
          description,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Any browser',
          isAccessibleForFree: true,
          inLanguage: 'en',
          publisher: { '@id': `${ORIGIN}/#organization` },
        },
      ],
    },
    body: `    <p class="eyebrow">Free tool</p>
    <h1>Personal trainer pricing calculator</h1>
    <p class="lede">Two numbers most trainers have never worked out: what an hour of coaching
      actually pays once the unpaid time around it is counted, and what a package discount really
      costs over a block. This does both. Nothing to install, no sign-up, and nothing you type
      leaves your browser.</p>

    <div class="note">
      <span class="label">Before you start</span>
      <p>There are no suggested prices anywhere on this page. What a session is worth depends on
        your city, your market and your experience, and any tool that hands you a number is
        guessing about all three. This one only does arithmetic on what you type.</p>
    </div>

    <h2>Your session</h2>
    <form id="calc" onsubmit="return false" style="margin:0 0 8px">
      <div style="display:grid;gap:14px;grid-template-columns:1fr">
        <label>What you charge for one session <span style="color:#6b7280">(in your currency)</span>
          <input id="rate" type="number" min="0" step="1" value="40" inputmode="decimal">
        </label>
        <label>Session length <span style="color:#6b7280">(minutes)</span>
          <input id="length" type="number" min="0" step="5" value="60" inputmode="numeric">
        </label>
        <label>Programming and planning, per session <span style="color:#6b7280">(minutes)</span>
          <input id="prep" type="number" min="0" step="5" value="10" inputmode="numeric">
        </label>
        <label>Travel and setup, per session <span style="color:#6b7280">(minutes)</span>
          <input id="travel" type="number" min="0" step="5" value="15" inputmode="numeric">
        </label>
        <label>Messages and check-ins, per session <span style="color:#6b7280">(minutes)</span>
          <input id="messaging" type="number" min="0" step="5" value="10" inputmode="numeric">
        </label>
        <label>Admin, invoicing and chasing, per session <span style="color:#6b7280">(minutes)</span>
          <input id="admin" type="number" min="0" step="5" value="5" inputmode="numeric">
        </label>
      </div>

      <h2>The package</h2>
      <div style="display:grid;gap:14px;grid-template-columns:1fr">
        <label>Sessions in a block
          <input id="blockSize" type="number" min="1" step="1" value="10" inputmode="numeric">
        </label>
        <label>Discount on the block <span style="color:#6b7280">(%)</span>
          <input id="discount" type="number" min="0" max="100" step="0.5" value="10" inputmode="decimal">
        </label>
      </div>
    </form>

    <h2>What that comes to</h2>
    <div id="results" aria-live="polite"><noscript>This calculator needs JavaScript. The same
      arithmetic is written out step by step in
      <a href="/guides/pricing-personal-training-packages">how to price personal training
      packages</a>, and the free spreadsheet does the package side of it.</noscript></div>

    <h2>How to read it</h2>
    <p>The row that matters most is <strong>"what that hour really pays"</strong>. Almost every
      package is priced off a session rate, and almost every session rate is set as though the
      session is the whole job. It is not: the programming, the travel, the messages and the
      invoicing are all work the client is buying, and they are all unpaid unless the rate covers
      them.</p>
    <p>The second is <strong>"what the discount gives away"</strong>. A package discount should buy
      you something — cash up front, or commitment. If a client would have booked ten sessions
      anyway, one at a time, then the discount bought nothing except the cash-flow benefit. That is
      why blanket "10% off anything over ten sessions" pricing quietly leaks money: it pays a
      discount to the clients least in need of persuading.</p>
    <p>Neither number tells you what to charge. They tell you what you are currently charging,
      which is the part most people are surprised by. The reasoning behind both, at length, is in
      <a href="/guides/pricing-personal-training-packages">how to price personal training
      packages</a>.</p>

    <h2>What this deliberately does not do</h2>
    <ul>
      <li><strong>It does not suggest a price.</strong> Nobody who has not seen your market can,
        and a number invented here would be confidently wrong about your income.</li>
      <li><strong>It does not compare you to anyone.</strong> There is no "average trainer charges"
        figure, because TRENIKO has not measured one and repeating a number from a listicle is not
        measurement.</li>
      <li><strong>It does not send anything anywhere.</strong> No account, no email, no storage.
        Close the tab and it is gone.</li>
    </ul>

    <h2>Once the price is decided, the tracking starts</h2>
    <p>A package price is a decision you make once. Keeping track of which client is how far
      through which block, at which price, and whether they have paid, is a job that comes back
      every week — and it is where the money actually leaks. Two ways to handle it:</p>
    <div class="cards">
      <a class="card" href="/free-personal-trainer-client-tracker">
        <h3>Free client &amp; session tracker</h3>
        <p>A spreadsheet where the remaining-session count works itself out. Excel or Google
          Sheets, no sign-up.</p>
      </a>
      <a class="card" href="/guides/session-packages">
        <h3>How to track packages and sessions left</h3>
        <p>Why the count drifts, and the one rule that keeps it honest.</p>
      </a>
    </div>
${cta('TRENIKO holds each package with its price, its session count and its expiry, counts down as sessions are completed, and flags a client before the block runs out — which is when the renewal conversation is worth having rather than after.')}

    <h2>Read next</h2>
    <div class="cards">
      <a class="card" href="/guides/pricing-personal-training-packages">
        <h3>Pricing personal training packages</h3>
        <p>The unpaid hours to count first, what a discount actually buys, and how to set an
          expiry that is not a trap.</p>
      </a>
      <a class="card" href="/guides/cancellation-policy">
        <h3>Writing a cancellation policy that holds</h3>
        <p>A price and a policy belong in the same message. The four things yours has to
          decide.</p>
      </a>
      <a class="card" href="/personal-trainer-client-management-software">
        <h3>Client management software for trainers</h3>
        <p>The five questions it has to answer instantly.</p>
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
