/**
 * Checks the static content pages against the mistakes that are invisible in a
 * browser and expensive in a search index.
 *
 *     node scripts/check-seo.mjs
 *
 * Exits non-zero on any failure, so it can gate a build.
 *
 * ── Why a script and not a careful reading ───────────────────────────────────
 * Every failure below is one a human eye passes over. A canonical pointing at
 * the wrong path renders identically. Two pages sharing a meta description look
 * fine one at a time. An internal link to a URL that does not exist is a 404
 * only for the person who clicks it, and the person who wrote it never does.
 * These are exactly the class of defect a machine should be finding.
 *
 * ── What it deliberately does not check ──────────────────────────────────────
 * Anything about content quality, keyword usage or "SEO score". Those are
 * judgements, and a script that pretends to make them produces a number people
 * optimise instead of the page.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');
const ORIGIN = 'https://treniko.com';

const failures = [];
const fail = (page, message) => failures.push(`${page}: ${message}`);

/* ── Collect the generated pages ───────────────────────────────────────────── */

/** Every index.html under public/, as a site path. */
function findPages(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    // assets-static and downloads hold files, not pages.
    if (entry === 'assets-static' || entry === 'downloads') continue;
    if (existsSync(join(full, 'index.html'))) out.push(`${prefix}/${entry}`);
    out.push(...findPages(full, `${prefix}/${entry}`));
  }
  return out;
}

const paths = findPages(PUBLIC).sort();
if (paths.length === 0) {
  console.error('  no content pages found under public/ — has the generator run?');
  process.exit(1);
}

const pages = paths.map((path) => ({
  path,
  html: readFileSync(join(PUBLIC, path.replace(/^\//, ''), 'index.html'), 'utf8'),
}));

const pick = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

/* ── Per-page checks ───────────────────────────────────────────────────────── */

for (const p of pages) {
  const { path, html } = p;

  p.title = pick(html, /<title>([\s\S]*?)<\/title>/);
  p.description = pick(html, /<meta name="description" content="([^"]*)"/);
  p.canonical = pick(html, /<link rel="canonical" href="([^"]*)"/);
  p.robots = pick(html, /<meta name="robots" content="([^"]*)"/);

  if (!p.title) fail(path, 'no <title>');
  else if (p.title.length > 65) fail(path, `title is ${p.title.length} chars — Google truncates around 60`);

  if (!p.description) fail(path, 'no meta description');
  else if (p.description.length > 165)
    fail(path, `meta description is ${p.description.length} chars — truncated around 160`);
  else if (p.description.length < 70)
    fail(path, `meta description is only ${p.description.length} chars`);

  if (p.canonical !== `${ORIGIN}${path}`)
    fail(path, `canonical is ${p.canonical}, expected ${ORIGIN}${path}`);

  if (p.robots && /noindex/.test(p.robots)) fail(path, 'is noindex but is a public content page');

  const h1s = html.match(/<h1[^>]*>/g) || [];
  if (h1s.length !== 1) fail(path, `${h1s.length} <h1> elements — expected exactly 1`);

  // Open Graph and Twitter must agree with the page they describe, or a share
  // preview advertises a different page than the one it links to.
  const ogUrl = pick(html, /<meta property="og:url" content="([^"]*)"/);
  if (ogUrl !== `${ORIGIN}${path}`) fail(path, `og:url is ${ogUrl}, expected ${ORIGIN}${path}`);
  const ogTitle = pick(html, /<meta property="og:title" content="([^"]*)"/);
  if (ogTitle !== p.title) fail(path, 'og:title does not match <title>');
  if (!/<meta name="twitter:card"/.test(html)) fail(path, 'no twitter:card');
  if (!/<meta name="viewport"/.test(html)) fail(path, 'no viewport meta — the page is not mobile-ready');

  // Structured data has to parse. An invalid JSON-LD block is silently ignored
  // by every consumer, which is the worst failure mode: it looks present.
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (blocks.length === 0) fail(path, 'no JSON-LD block');
  for (const [, raw] of blocks) {
    try {
      const data = JSON.parse(raw);
      const flat = JSON.stringify(data);
      // Nothing may claim a rating, a review or a price. TRENIKO has no
      // reviews; marking any up would be fabricated structured data and a
      // manual action waiting to happen.
      for (const banned of ['aggregateRating', 'reviewCount', 'ratingValue', 'Review']) {
        if (flat.includes(`"${banned}`) || flat.includes(`"@type":"${banned}"`))
          fail(path, `JSON-LD contains ${banned} — TRENIKO has no reviews to mark up`);
      }
    } catch (e) {
      fail(path, `JSON-LD does not parse: ${e.message}`);
    }
  }

  // Hidden text. The prerender step refuses opacity-0 for the same reason.
  if (/opacity-0|display:\s*none|visibility:\s*hidden/.test(html))
    fail(path, 'contains hidden content — that is cloaked text, not SEO');
}

/* ── Cross-page checks ─────────────────────────────────────────────────────── */

const seen = new Map();
for (const key of ['title', 'description']) {
  seen.clear();
  for (const p of pages) {
    const v = p[key];
    if (!v) continue;
    if (seen.has(v)) fail(p.path, `duplicate ${key}, shared with ${seen.get(v)}`);
    else seen.set(v, p.path);
  }
}

/* ── Internal links ────────────────────────────────────────────────────────── */

/**
 * SPA routes are served by the application, not from disk, so they cannot be
 * resolved against public/. Listed explicitly rather than skipped by pattern,
 * so a typo in one is still caught.
 */
const SPA_ROUTES = new Set(['/', '/register', '/login', '/privacy', '/terms']);

const linkTargets = new Map();
for (const p of pages) {
  for (const [, href] of p.html.matchAll(/href="(\/[^"#?]*)"/g)) {
    if (!linkTargets.has(href)) linkTargets.set(href, new Set());
    linkTargets.get(href).add(p.path);
  }
}

for (const [href, sources] of linkTargets) {
  if (SPA_ROUTES.has(href)) continue;
  const asFile = join(PUBLIC, href.replace(/^\//, ''));
  const ok = existsSync(asFile) || existsSync(join(asFile, 'index.html'));
  if (!ok) fail([...sources].join(', '), `links to ${href}, which does not exist`);
}

/* ── Orphans ───────────────────────────────────────────────────────────────── */

for (const p of pages) {
  const inbound = [...linkTargets.entries()].filter(
    ([href, sources]) => href === p.path && [...sources].some((s) => s !== p.path)
  );
  if (inbound.length === 0) fail(p.path, 'is an orphan — no other page links to it');
}

/* ── Sitemap ───────────────────────────────────────────────────────────────── */

const sitemap = readFileSync(join(PUBLIC, 'sitemap.xml'), 'utf8');
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, u]) =>
  u.replace(ORIGIN, '')
);

for (const p of pages) {
  if (!listed.includes(p.path)) fail(p.path, 'is not in sitemap.xml');
}
for (const url of listed) {
  if (SPA_ROUTES.has(url)) continue;
  if (!pages.some((p) => p.path === url)) fail('sitemap.xml', `lists ${url}, which has no page on disk`);
}

const dupes = listed.filter((u, i) => listed.indexOf(u) !== i);
if (dupes.length) fail('sitemap.xml', `duplicate entries: ${dupes.join(', ')}`);

/* ── Report ────────────────────────────────────────────────────────────────── */

if (failures.length) {
  console.error(`\n  ${failures.length} SEO problem(s):\n`);
  for (const f of failures) console.error(`   ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log(`\n  ${pages.length} content pages checked, ${listed.length} sitemap URLs. No problems.\n`);
