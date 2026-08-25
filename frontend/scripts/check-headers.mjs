/**
 * Asserts the security and caching headers a deployed TRENIKO actually sends.
 *
 *     node scripts/check-headers.mjs                    # production
 *     node scripts/check-headers.mjs https://staging... # anywhere else
 *
 * Exits non-zero on any failure.
 *
 * ── Why this is a script against a live origin, not a unit test ──────────────
 * Every header checked here is produced by nginx, not by the application. There
 * is no function to call and nothing to import: the only thing that can be
 * asserted is what a real request receives. A unit test here would test a
 * fixture of the config rather than the config, and would pass while production
 * sent nothing at all — which is precisely the state this repository was in
 * until 25 Aug 2026.
 *
 * ── Why the Cloudflare bypass matters ────────────────────────────────────────
 * Requests are sent with a cache-busting query string. Without it a cached edge
 * response is returned, and an edge entry stored before a header change does
 * not have the new headers — so the check reports a failure that has already
 * been fixed, or worse, a pass that is only true of a stale copy. This was
 * observed: `cf-cache-status: HIT` on an asset response with none of the new
 * headers on it, minutes after they went live.
 *
 * ── What is deliberately NOT asserted ────────────────────────────────────────
 * The exact CSP string. Pinning it byte-for-byte turns every legitimate policy
 * change into a failing test that gets updated without being read, which is
 * worse than not checking. The directives that carry the security value are
 * asserted individually, including the negative ones — `script-src` must not
 * acquire `'unsafe-inline'`.
 */

const ORIGIN = process.argv[2] || 'https://treniko.com';

const failures = [];
const notes = [];
const fail = (where, message) => failures.push(`${where}: ${message}`);

/** A request the CDN cannot answer from cache. See the note above. */
async function head(path) {
  const url = `${ORIGIN}${path}${path.includes('?') ? '&' : '?'}hdrcheck=${Date.now()}${Math.random()
    .toString(36)
    .slice(2)}`;
  const res = await fetch(url, { method: 'GET', redirect: 'manual' });
  return { status: res.status, headers: res.headers, cf: res.headers.get('cf-cache-status') };
}

/* ── What every static response must carry ─────────────────────────────────── */

const REQUIRED = {
  'strict-transport-security': /max-age=\d{7,}/,
  'x-content-type-options': /^nosniff$/,
  'referrer-policy': /strict-origin-when-cross-origin|no-referrer/,
  'x-frame-options': /SAMEORIGIN|DENY/,
  'permissions-policy': /geolocation=\(\)/,
};

/** Pages, assets and a download — every kind of thing nginx serves from disk. */
const STATIC_PATHS = [
  '/',
  '/guides',
  '/guides/cancellation-policy',
  '/personal-trainer-software',
  '/free-personal-trainer-client-tracker',
  '/login',
  '/register',
  '/privacy',
  '/downloads/treniko-client-session-tracker.xlsx',
];

console.log(`\n  checking ${ORIGIN}\n`);

for (const path of STATIC_PATHS) {
  const { status, headers } = await head(path);

  if (status >= 500) fail(path, `returned ${status}`);

  for (const [name, pattern] of Object.entries(REQUIRED)) {
    const value = headers.get(name);
    if (!value) fail(path, `missing ${name}`);
    else if (!pattern.test(value)) fail(path, `${name} is "${value}", expected to match ${pattern}`);
  }

  const csp = headers.get('content-security-policy');
  if (!csp) {
    fail(path, 'missing content-security-policy');
  } else {
    // Report-Only is the right state while a policy is being validated and the
    // wrong state to leave production in — it looks identical in a header dump
    // and protects nothing.
    if (headers.get('content-security-policy-report-only') && !csp) {
      fail(path, 'CSP is Report-Only — it is not being enforced');
    }
    const must = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "script-src 'self'",
      "connect-src 'self'",
    ];
    for (const directive of must) {
      if (!csp.includes(directive)) fail(path, `CSP is missing "${directive}"`);
    }

    // The negative assertion is the one worth having. script-src acquiring
    // 'unsafe-inline' would silently undo the reason the beacon was moved out
    // of the page in the first place.
    const scriptSrc = csp.match(/script-src ([^;]*)/)?.[1] ?? '';
    if (scriptSrc.includes('unsafe-inline')) fail(path, "script-src has 'unsafe-inline'");
    if (scriptSrc.includes('unsafe-eval')) fail(path, "script-src has 'unsafe-eval'");
  }
}

/* ── The API defends itself, and must not be double-covered ────────────────── */

{
  const { headers } = await head('/api/health');

  // helmet's own headers. Their absence means the API is not running behind
  // helmet any more, which is a bigger problem than a missing nginx header.
  if (!headers.get('strict-transport-security')) fail('/api/health', 'no HSTS from helmet');
  if (headers.get('x-frame-options') !== 'DENY')
    fail('/api/health', `x-frame-options is "${headers.get('x-frame-options')}", expected DENY from helmet`);

  const csp = headers.get('content-security-policy') ?? '';
  if (!csp.includes("default-src 'none'"))
    fail('/api/health', `CSP is "${csp}" — expected helmet's default-src 'none' for JSON`);

  // If nginx ever starts adding its own headers here, the two policies fight.
  // `getSetCookie`-style duplicates come back comma-joined in one value.
  if ((headers.get('x-frame-options') ?? '').includes(','))
    fail('/api/health', 'duplicate x-frame-options — nginx is adding one on top of helmet');
  if (csp.includes("default-src 'self'"))
    fail('/api/health', 'nginx CSP is leaking into /api — remove the include from location /api');
}

/* ── Caching ───────────────────────────────────────────────────────────────── */

for (const path of ['/', '/guides', '/login']) {
  const { headers } = await head(path);
  const cc = headers.get('cache-control') ?? '';
  // HTML names the content-hashed bundles. A cached copy outlives the assets it
  // points at, and the visitor gets a blank page after the next deploy.
  if (!/no-cache|must-revalidate|max-age=0/.test(cc))
    fail(path, `HTML cache-control is "${cc || 'absent'}" — must revalidate`);
}

/* ── Redirects and canonical host ──────────────────────────────────────────── */

{
  const res = await fetch('https://www.treniko.com/?hdrcheck=1', { redirect: 'manual' });
  if (![301, 308].includes(res.status))
    fail('www', `https://www.treniko.com returned ${res.status}, expected a 301 to the apex`);
  else if (!(res.headers.get('location') ?? '').startsWith('https://treniko.com'))
    fail('www', `redirects to ${res.headers.get('location')}, expected the apex`);
}

/* ── The robots.txt that is actually SERVED ────────────────────────────────── */

/**
 * Not the one in the repository — the one a crawler receives.
 *
 * These are different documents. Cloudflare prepends a "Managed Content" block
 * to robots.txt at the edge: a `Content-Signal` line, `User-agent: *` with
 * `Allow: /`, and a list of AI training crawlers it disallows. None of that is
 * in this repository and none of it appears in `check-seo.mjs`, which reads
 * `public/robots.txt` off disk and therefore validates a file nobody is served.
 *
 * The consequence worth catching: the served file now contains TWO
 * `User-agent: *` groups. RFC 9309 says records for the same user-agent are
 * merged and the longest matching rule wins, so `Disallow: /dashboard` still
 * beats Cloudflare's `Allow: /`. That is the correct reading, and it is exactly
 * the kind of correctness that should be asserted rather than reasoned about
 * once and forgotten — if a future edge feature injected a bare `Disallow: /`,
 * the site would leave the index and nothing else here would notice.
 */
{
  const res = await fetch(`${ORIGIN}/robots.txt?hdrcheck=${Date.now()}`);
  const robots = await res.text();

  if (res.status !== 200) fail('/robots.txt', `returned ${res.status}`);

  // Split into groups, keeping the agent each one belongs to.
  const groups = [];
  let current = null;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      current = { agent: value, rules: [] };
      groups.push(current);
    } else if (current && (key === 'allow' || key === 'disallow')) {
      current.rules.push({ type: key, path: value });
    }
  }

  const wildcard = groups.filter((g) => g.agent === '*');
  if (wildcard.length === 0) fail('/robots.txt', 'no `User-agent: *` group is served');

  // Merged view, per RFC 9309.
  const wildcardRules = wildcard.flatMap((g) => g.rules);

  // The one that would take the whole site out of the index.
  if (wildcardRules.some((r) => r.type === 'disallow' && r.path === '/'))
    fail('/robots.txt', 'a `User-agent: *` group disallows the entire site');

  // Private routes must still lose to nothing. Longest match wins, so an
  // explicit Disallow beats a shorter Allow — assert the rule is present.
  for (const path of ['/dashboard', '/admin', '/api/']) {
    const disallowed = wildcardRules.some((r) => r.type === 'disallow' && path.startsWith(r.path) && r.path !== '/');
    if (!disallowed) fail('/robots.txt', `${path} is not disallowed for *`);
    const longerAllow = wildcardRules.some(
      (r) => r.type === 'allow' && r.path.length > path.length && path.startsWith(r.path)
    );
    if (longerAllow) fail('/robots.txt', `an Allow rule out-specifies the disallow on ${path}`);
  }

  if (!/^Sitemap:\s*https:\/\/treniko\.com\/sitemap\.xml$/m.test(robots))
    fail('/robots.txt', 'the sitemap line is missing from the served file');

  // The agents that fetch because a person asked must NOT be disallowed. These
  // are not training crawlers: blocking them means a trainer who asks an
  // assistant to open treniko.com is told it cannot be reached.
  for (const agent of ['ChatGPT-User', 'Claude-User', 'OAI-SearchBot']) {
    const g = groups.find((x) => x.agent.toLowerCase() === agent.toLowerCase());
    if (g && g.rules.some((r) => r.type === 'disallow' && r.path === '/'))
      fail('/robots.txt', `${agent} is disallowed — that blocks user-initiated retrieval, not training`);
  }

  // Informational: say when the edge is rewriting the file, so a surprising
  // diff between repo and production is explained rather than investigated.
  if (/Cloudflare Managed content/i.test(robots)) {
    notes.push(
      'robots.txt is being extended at the edge by Cloudflare Managed Content '
      + '(Content-Signal + AI training crawler blocks). The served file is not the repo file.'
    );
  }
}

/* ── Report ────────────────────────────────────────────────────────────────── */

if (notes.length) for (const n of notes) console.log(`   · ${n}`);

if (failures.length) {
  console.error(`\n  ${failures.length} header problem(s):\n`);
  for (const f of failures) console.error(`   ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log(`  ${STATIC_PATHS.length} static paths + /api + caching + www redirect. All headers correct.\n`);
