/**
 * Bakes the rendered homepage into dist/index.html, and leaves a bare shell at
 * dist/app.html for every other route.
 *
 * Runs after `vite build`, as part of `npm run build`. See src/entry-prerender.jsx
 * for why this exists and why it is a build step rather than a server.
 *
 * ── Why two HTML files ───────────────────────────────────────────────────────
 * index.html is served for `/` only. Every other SPA route falls back to
 * app.html, which is the untouched shell.
 *
 * That split is not tidiness, it is a correctness requirement. One file cannot
 * do both jobs: if the prerendered homepage were also the SPA fallback, then
 * `/login` would arrive with the homepage's markup already in `#root`, React
 * would try to hydrate a login form onto a landing page, and every private
 * route would start with a full hydration mismatch and a flash of the wrong
 * page. nginx routes the two apart — see the deploy notes at the bottom.
 *
 * ── What this refuses to do ──────────────────────────────────────────────────
 * It injects only what the client itself renders. No extra keywords, no hidden
 * blocks, no text that a visitor cannot see. The markup written here is
 * byte-identical to what React produces in the browser on first paint, which is
 * the only version of "SEO content" that is not a lie to somebody.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..');
const DIST = join(FRONTEND, 'dist');
const SSR_ENTRY = join(FRONTEND, 'dist-ssr', 'entry-prerender.js');

const ROOT_DIV = '<div id="root"></div>';

function fail(message) {
  // A silent failure here is the dangerous one: the build would "succeed" and
  // quietly ship an empty homepage again, which is precisely the bug this
  // exists to fix and precisely the bug nobody would notice.
  console.error(`\n  prerender FAILED: ${message}\n`);
  process.exit(1);
}

if (!existsSync(SSR_ENTRY)) {
  fail(`no SSR bundle at ${SSR_ENTRY} — "vite build --ssr" must run first`);
}

const indexPath = join(DIST, 'index.html');
if (!existsSync(indexPath)) fail(`no dist/index.html — "vite build" must run first`);

const shell = readFileSync(indexPath, 'utf8');
if (!shell.includes(ROOT_DIV)) {
  fail(`dist/index.html does not contain ${ROOT_DIV} — the template changed shape`);
}

// The untouched shell serves every route that is not `/`.
writeFileSync(join(DIST, 'app.html'), shell, 'utf8');

const { render } = await import(`file://${SSR_ENTRY}`);
const html = render();

if (typeof html !== 'string' || html.length < 2000) {
  fail(`render() produced ${html?.length ?? 0} characters — expected the full landing page`);
}

// The two things that would make this actively harmful rather than merely
// broken, checked before anything is written.
if (/opacity-0/.test(html)) {
  fail('rendered markup contains opacity-0 — that is invisible text in the HTML, not SEO');
}
if (!/Run your personal training business/.test(html)) {
  fail('rendered markup is missing the H1 — it is not the landing page');
}

writeFileSync(indexPath, shell.replace(ROOT_DIV, `<div id="root">${html}</div>`), 'utf8');

const words = html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(`  prerendered / into dist/index.html (${words} words of crawlable text)`);
console.log(`  wrote dist/app.html (bare shell for every other route)`);
console.log(`\n  nginx must serve app.html as the SPA fallback, not index.html.`);
