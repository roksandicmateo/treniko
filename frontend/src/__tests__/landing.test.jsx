/**
 * The public landing page, and the routing/indexing boundary it introduces.
 *
 * ── What this suite is defending ─────────────────────────────────────────────
 * Making `/` public is the first time this application has served anything to an
 * unauthenticated visitor beyond a login form. Three things can go wrong quietly:
 *
 *   1. `/` stops being public — a stray redirect puts the login form back and
 *      the whole acquisition funnel dies without an error anywhere.
 *   2. `/dashboard` stops being private — the far worse direction.
 *   3. The indexing boundary drifts, and Google starts indexing `/login`, the
 *      dashboard or the admin panel.
 *
 * The assertions below are about routing, auth boundaries and document
 * metadata. They deliberately do not assert on marketing copy or layout, so
 * rewriting the page does not break the suite — with one exception: the honesty
 * checks near the end, which exist precisely because that copy must not drift
 * into claims the product cannot support.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import Landing from '../pages/Landing';
import PrivateRoute from '../components/PrivateRoute';
import { AuthProvider } from '../context/AuthContext';
import { applyRouteMeta, PUBLIC_ROUTES, SITE_ORIGIN } from '../seo/RouteMeta';

// The landing page and PrivateRoute both read i18n / auth context. i18n is
// initialised for its side effect the same way main.jsx does it.
import '../i18n.js';

// AuthProvider only trusts a persisted session once the backend confirms it, so
// a signed-in visitor cannot be simulated with localStorage alone. Only
// validateToken is stubbed; every other export is left as-is.
vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    authAPI: {
      ...actual.authAPI,
      validateToken: vi.fn(() =>
        Promise.resolve({ data: { user: { id: 'u1', email: 't@example.com' } } })
      ),
    },
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** Renders wherever the router ended up so a test can assert on it. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const renderApp = (initialEntry) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<div>login screen</div>} />
          <Route path="/register" element={<div>register screen</div>} />
          <Route
            path="/dashboard"
            element={<PrivateRoute><div>dashboard</div></PrivateRoute>}
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

const at = () => screen.getByTestId('location').textContent;

/* ── 1. The public entry point ─────────────────────────────────────────────── */

describe('the landing page is the public entry point', () => {
  test('an anonymous visitor at / gets the landing page, not a redirect', async () => {
    renderApp('/');

    expect(at()).toBe('/');
    // The one h1 on the page is the product's positioning line.
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toBeTruthy();
    expect(screen.queryByText('login screen')).toBeNull();
  });

  test('it offers both a sign-up and a log-in route to an anonymous visitor', async () => {
    renderApp('/');

    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));

    expect(hrefs).toContain('/register');
    expect(hrefs).toContain('/login');
    // Nothing should push an anonymous visitor straight at the app.
    expect(hrefs).not.toContain('/dashboard');
  });

  test('a signed-in trainer is offered the app instead of a login link', async () => {
    // A persisted token plus user is what AuthProvider looks for before it
    // calls validateToken (stubbed above to succeed). Only once that resolves
    // does `user` become truthy and the landing page swap its CTA.
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 't@example.com' }));

    renderApp('/');

    const links = await screen.findAllByRole('link');
    const hrefs = links.map((a) => a.getAttribute('href'));

    expect(hrefs).toContain('/dashboard');
  });

  test('every navigation target is same-origin, or one of two allowlisted profiles', async () => {
    // The footer links out to the two TRENIKO social profiles. Those are the
    // only off-origin destinations this page may have, and they are pinned by
    // exact URL: an allowlist reading "any https link is fine" would not have
    // caught the open-redirect shapes this suite exists to prevent.
    const ALLOWED_EXTERNAL = new Set([
      'https://www.instagram.com/treniko_fitness/',
      'https://www.facebook.com/profile.php?id=61593112186107',
    ]);

    renderApp('/');

    for (const a of screen.getAllByRole('link')) {
      const href = a.getAttribute('href') || '';
      // mailto: is the one deliberate exception — the contact address.
      if (href.startsWith('mailto:')) continue;
      if (href.startsWith('#')) continue;

      if (/^https?:/i.test(href)) {
        expect(ALLOWED_EXTERNAL.has(href), `off-origin link not allowlisted: ${href}`).toBe(true);
        // A new-tab target gets window.opener access to this page unless severed.
        expect(a.getAttribute('rel') || '').toContain('noopener');
        continue;
      }

      expect(href.startsWith('/')).toBe(true);
      // '//host' and '/\host' both resolve off-origin in a browser.
      expect(href.startsWith('//')).toBe(false);
      expect(href.startsWith('/\\')).toBe(false);
      expect(new URL(href, 'https://treniko.com').origin).toBe('https://treniko.com');
    }
  });

  test('every "Start for free" CTA points at /register', async () => {
    renderApp('/');

    const ctas = screen
      .getAllByRole('link')
      .filter((a) => /start for free/i.test(a.textContent || ''));

    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta.getAttribute('href')).toBe('/register');
  });

  test('the product showcase exposes its screens as tabs and switches between them', async () => {
    renderApp('/');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Dashboard', 'Clients', 'Packages', 'Payments']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    fireEvent.click(tabs[1]);
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel')).toBeTruthy();
  });

  test('the mobile menu button controls a menu and reports its state', async () => {
    renderApp('/');

    const toggle = screen.getByRole('button', { name: /open menu/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('mobile-menu');

    fireEvent.click(toggle);
    expect(
      screen.getByRole('button', { name: /close menu/i }).getAttribute('aria-expanded')
    ).toBe('true');
  });
});

/* ── 2. The private side is unchanged ──────────────────────────────────────── */

describe('opening the app public did not open the app', () => {
  test('an anonymous visitor at /dashboard is still sent to the login screen', async () => {
    renderApp('/dashboard');

    // PrivateRoute renders a loading state until AuthProvider settles.
    await screen.findByText('login screen');
    expect(at()).toBe('/login');
  });

  test('the landing page renders no admin surface at all', async () => {
    renderApp('/');

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') || '');
    expect(hrefs.some((h) => h.startsWith('/admin'))).toBe(false);

    // The word "admin" legitimately appears in the copy ("less admin"), so the
    // check is on link targets and link text, not on prose.
    const linkText = screen.getAllByRole('link').map((a) => (a.textContent || '').trim());
    expect(linkText.some((t) => /^admin/i.test(t))).toBe(false);
  });
});

/* ── 3. The indexing boundary ──────────────────────────────────────────────── */

describe('search-engine indexing boundary', () => {
  const robotsContent = () =>
    document.head.querySelector('meta[name="robots"]')?.getAttribute('content');
  const canonicalHref = () =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  test('the public routes are indexable and carry a canonical URL', () => {
    for (const path of Object.keys(PUBLIC_ROUTES)) {
      applyRouteMeta(path);
      expect(robotsContent()).toBe('index, follow');
      expect(canonicalHref()).toBe(`${SITE_ORIGIN}${path}`);
      expect(document.title).toBe(PUBLIC_ROUTES[path].title);
    }
  });

  test('every authentication, app and admin route is noindex with no canonical', () => {
    const private_ = [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/check-email',
      '/dashboard',
      '/dashboard/clients',
      '/dashboard/clients/8f1c0b6e-0000-4000-8000-000000000000',
      '/admin',
      '/admin/trainers',
      '/some/route/that/does/not/exist',
    ];

    for (const path of private_) {
      applyRouteMeta(path);
      expect(robotsContent(), `robots for ${path}`).toBe('noindex, nofollow');
      expect(canonicalHref(), `canonical for ${path}`).toBeNull();
    }
  });

  test('a canonical left over from a public page is removed on a private one', () => {
    applyRouteMeta('/');
    expect(canonicalHref()).toBe('https://treniko.com/');

    applyRouteMeta('/dashboard');
    expect(canonicalHref()).toBeNull();
  });

  test('the canonical URL cannot be steered by the path', () => {
    // Only exact keys of PUBLIC_ROUTES are ever treated as public, so a path
    // that merely looks like one gets no canonical at all.
    applyRouteMeta('/@evil.example.com');
    expect(canonicalHref()).toBeNull();
    applyRouteMeta('//evil.example.com');
    expect(canonicalHref()).toBeNull();
  });
});

/* ── 4. The static files the crawlers read ─────────────────────────────────── */

describe('static SEO files', () => {
  const readPublic = (name) =>
    readFileSync(join(process.cwd(), 'public', name), 'utf8');
  const indexHtml = () => readFileSync(join(process.cwd(), 'index.html'), 'utf8');

  test('index.html is indexable and declares an absolute og:image', () => {
    const html = indexHtml();
    expect(html).toMatch(/<meta name="robots" content="index, follow"/);
    expect(html).toMatch(
      /<meta property="og:image" content="https:\/\/treniko\.com\/og-image\.png"/
    );
    expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/treniko\.com\/"/);
  });

  test('every icon and image index.html references actually exists', () => {
    const html = indexHtml();
    const referenced = [...html.matchAll(/(?:href|content)="(?:https:\/\/treniko\.com)?(\/[^"]+\.(?:png|svg|ico))"/g)]
      .map((m) => m[1]);

    expect(referenced.length).toBeGreaterThan(0);
    for (const path of new Set(referenced)) {
      // Throws if the file is missing — which is exactly the bug this replaces,
      // where /favicon.ico and /apple-touch-icon.png fell through to the SPA.
      expect(() => readPublic(path.replace(/^\//, ''))).not.toThrow();
    }
  });

  test('the og:image is a real 1200x630 PNG', () => {
    const buf = readFileSync(join(process.cwd(), 'public', 'og-image.png'));
    expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG');
    // IHDR width/height live at fixed offsets in a PNG header.
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
  });

  test('robots.txt disallows every private route and points at the sitemap', () => {
    const robots = readPublic('robots.txt');
    for (const path of ['/login', '/register', '/dashboard', '/admin', '/api/']) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
    expect(robots).toContain('Sitemap: https://treniko.com/sitemap.xml');
    // A blanket disallow would take the landing page out of the index too.
    expect(robots).not.toMatch(/^Disallow: \/$/m);
  });

  test('the sitemap lists only public URLs', () => {
    const sitemap = readPublic('sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect(locs).toContain('https://treniko.com/');
    for (const loc of locs) {
      const path = new URL(loc).pathname;
      expect(
        Object.prototype.hasOwnProperty.call(PUBLIC_ROUTES, path),
        `${loc} is in the sitemap but is not a public route`
      ).toBe(true);
    }
  });
});

/* ── 5. Honesty ────────────────────────────────────────────────────────────── */

describe('structured data says only what the product can back', () => {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

  const graph = () => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(m, 'no JSON-LD block found in index.html').toBeTruthy();
    return JSON.parse(m[1])['@graph'];
  };

  test('the JSON-LD is valid JSON and declares the expected types', () => {
    const types = graph().map((n) => n['@type']);
    expect(types).toContain('SoftwareApplication');
    expect(types).toContain('Organization');
  });

  test('it carries no rating or review markup', () => {
    // TRENIKO has almost no customers. Any rating here would be invented, and
    // invented review markup is a lie to the reader and a manual action from
    // Google. This test is the thing standing between "we should add rich
    // snippets" and a fabricated one.
    const raw = JSON.stringify(graph());
    for (const forbidden of ['aggregateRating', 'ratingValue', 'reviewCount', 'Review']) {
      expect(raw.includes(forbidden), `JSON-LD contains ${forbidden}`).toBe(false);
    }
  });

  test('the advertised price matches what the product can actually charge', () => {
    const app = graph().find((n) => n['@type'] === 'SoftwareApplication');
    // There is no payment processor in the product, so zero is the only
    // honest price — the same claim the pricing section makes in words.
    expect(app.offers.price).toBe('0');
    expect(app.offers.priceCurrency).toBe('EUR');
  });

  test('the social profiles match the ones the footer links', () => {
    const org = graph().find((n) => n['@type'] === 'Organization');
    expect(org.sameAs).toContain('https://www.instagram.com/treniko_fitness/');
    expect(org.sameAs).toContain('https://www.facebook.com/profile.php?id=61593112186107');
  });

  test('every feature it lists is one the landing page also claims', () => {
    const app = graph().find((n) => n['@type'] === 'SoftwareApplication');
    // Structured data drifting away from the visible copy is how a page ends
    // up advertising something it does not do.
    for (const keyword of ['Client', 'session', 'package', 'Payment', 'Progress', 'Training']) {
      expect(
        app.featureList.some((f) => f.toLowerCase().includes(keyword.toLowerCase())),
        `featureList mentions nothing about ${keyword}`
      ).toBe(true);
    }
  });
});

describe('the copy does not claim things the product cannot back', () => {
  /**
   * Landing.jsx with its comments removed. The comments explain *why* the copy
   * avoids fabricated proof, so they naturally contain the very words the scan
   * bans — reading them would make this test fail on its own documentation.
   */
  const source = () =>
    readFileSync(join(process.cwd(), 'src', 'pages', 'Landing.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');

  test('no fabricated social proof or superlatives', () => {
    // The account has almost no traction. Any of these appearing means someone
    // reached for filler, which is the failure mode this whole page avoids.
    const banned = [
      /\btrusted by\b/i,
      /\bjoin \d/i,
      /\b\d[\d,.]*\+?\s*(?:happy\s+)?(?:trainers|customers|users|coaches)\b/i,
      /\btestimonial/i,
      /\brevolutionary\b/i,
      /\bgame[- ]chang/i,
      /\bworld[- ]class\b/i,
      /\b#1\b/,
      /\bnumber one\b/i,
      /\bbest[- ]in[- ]class\b/i,
    ];

    const src = source();
    for (const re of banned) {
      expect(re.test(src), `landing copy matched ${re}`).toBe(false);
    }
  });

  test('it does not advertise a plan price the product cannot charge', () => {
    // There is no payment processor in the codebase, so no plan price on this
    // page could be paid. The seeded Pro/Enterprise amounts in migration 004
    // must never appear, and the only amount attached to a billing period is 0.
    //
    // Sample payment amounts inside the product mock are deliberately NOT
    // covered here — they illustrate a trainer recording what a client paid
    // them, which is a real feature, not a TRENIKO price.
    const src = source();

    for (const seeded of ['€29', '€99', '€290', '€990']) {
      expect(src.includes(seeded), `seeded plan price ${seeded} appears in the copy`).toBe(false);
    }

    const perPeriod = [...src.matchAll(/€\s*([\d.,]+)\s*(?:<[^>]*>)*\s*(?:\/|per)\s*(?:month|year)/gi)];
    expect(perPeriod.length).toBeGreaterThan(0);
    for (const m of perPeriod) {
      expect(Number(m[1].replace(',', '.'))).toBe(0);
    }
  });

  test('the free-plan limits match what registration actually grants', () => {
    // backend/migrations/004_subscriptions.sql seeds the free plan with
    // max_clients = 5 and max_sessions_per_month = 20, and authController
    // assigns that plan on registration. If those change, this copy is wrong.
    const src = source();
    expect(src).toMatch(/5 clients/);
    expect(src).toMatch(/20 sessions/);
  });
});

/* ── 6. What the public page must never do ─────────────────────────────────── */

describe('the public page leaks nothing and calls nothing', () => {
  test('an anonymous visit makes no authenticated API call', async () => {
    const { authAPI } = await import('../services/api');
    authAPI.validateToken.mockClear();

    renderApp('/');
    await screen.findByRole('heading', { level: 1 });

    // AuthProvider only validates when a session is already persisted. A cold
    // visitor must not cause a request to an authenticated endpoint.
    expect(authAPI.validateToken).not.toHaveBeenCalled();
  });

  test('the rendered DOM carries no credentials, tokens or internal hosts', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });

    const html = document.body.innerHTML;
    // Note: the word "password" appears legitimately in the sign-up copy
    // ("Email, a password and your name"), so the check is for credential
    // *values* and internal hosts, not for the word itself.
    for (const forbidden of [/localhost/i, /127\.0\.0\.1/, /Bearer\s+[A-Za-z0-9_-]/, /eyJ[A-Za-z0-9_-]{10,}/, /api[_-]?key\s*[=:]/i, /password\s*[=:]/i]) {
      expect(forbidden.test(html), `landing DOM matched ${forbidden}`).toBe(false);
    }
  });

  test('the sample data in the product mock is not a real person', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });

    const text = document.body.textContent || '';
    // textContent runs adjacent nodes together, so scanning it for addresses
    // produces junk like "treniko.comFAQQuestions". The reliable surface is the
    // mailto: links themselves — and separately, that the product mock contains
    // no '@' at all, so no client address can hide in the sample data.
    const mailtos = [...document.querySelectorAll('a[href^="mailto:"]')].map((a) =>
      a.getAttribute('href').replace('mailto:', '')
    );
    expect(mailtos.length).toBeGreaterThan(0);
    expect([...new Set(mailtos)]).toEqual(['info@treniko.com']);

    const showcase = document.querySelector('[role="tabpanel"]');
    expect(showcase).toBeTruthy();
    expect((showcase.textContent || '').includes('@')).toBe(false);

    expect(/\+\d[\d\s()-]{7,}/.test(text), 'a phone number appears in the mock').toBe(false);

    // Client names in the mock are a first name plus an initial.
    for (const name of ['Alex M.', 'Jordan T.', 'Sam K.']) {
      expect(text.includes(name)).toBe(true);
    }
  });

  test('no dangerouslySetInnerHTML anywhere in the landing surface', () => {
    const files = [
      join(process.cwd(), 'src', 'pages', 'Landing.jsx'),
      join(process.cwd(), 'src', 'pages', 'landing', 'ProductShowcase.jsx'),
    ];
    for (const f of files) {
      expect(readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML')).toBe(false);
    }
  });
});

/* ── 7. Attribution capture ────────────────────────────────────────────────── */

describe('first-touch attribution', () => {
  let attribution;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    attribution = await import('../utils/attribution');
  });

  const grantConsent = () =>
    localStorage.setItem(
      'treniko_cookie_consent',
      JSON.stringify({ necessary: true, analytics: true, preferences: true })
    );

  const withUrl = (search) => {
    // jsdom allows replaceState within the same origin.
    window.history.replaceState({}, '', `/${search}`);
  };

  test('captures nothing without analytics consent', () => {
    withUrl('?utm_source=instagram&utm_medium=social&utm_campaign=organic');

    expect(attribution.captureAttribution()).toBeNull();
    expect(sessionStorage.getItem('treniko_attribution')).toBeNull();
  });

  test('captures the UTM set once consent is given', () => {
    grantConsent();
    withUrl('?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=reel-p05');

    const record = attribution.captureAttribution();
    expect(record.utm_source).toBe('instagram');
    expect(record.utm_medium).toBe('social');
    expect(record.utm_campaign).toBe('organic');
    expect(record.utm_content).toBe('reel-p05');
    expect(record.landing_path).toBe('/');
    expect(record.first_seen_at).toBeTruthy();
  });

  test('first touch wins — a later visit never overwrites it', () => {
    grantConsent();
    withUrl('?utm_source=instagram&utm_campaign=organic');
    attribution.captureAttribution();

    withUrl('?utm_source=facebook&utm_campaign=paid');
    const second = attribution.captureAttribution();

    expect(second.utm_source).toBe('instagram');
    expect(attribution.getAttribution().utm_source).toBe('instagram');
  });

  test('stores nothing for a plain direct visit', () => {
    grantConsent();
    withUrl('');

    expect(attribution.captureAttribution()).toBeNull();
    expect(sessionStorage.getItem('treniko_attribution')).toBeNull();
  });

  test('caps hostile values rather than storing them whole', () => {
    grantConsent();
    withUrl(`?utm_source=${'x'.repeat(500)}`);

    const record = attribution.captureAttribution();
    expect(record.utm_source.length).toBe(120);
  });

  test('records the landing path without its query string', () => {
    grantConsent();
    withUrl('?utm_source=instagram&utm_content=secret-value');

    const record = attribution.captureAttribution();
    expect(record.landing_path).toBe('/');
    expect(record.landing_path.includes('?')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the product showcase cannot widen the page on a phone', () => {
  // Found in visual QA at 375 px: selecting the Clients tab pushed the whole
  // document to 491 px and the page scrolled sideways.
  //
  // The cause was not the table. The table is deliberately `min-w-[420px]`
  // inside an `overflow-x-auto` wrapper, which is the right pattern — a
  // four-column table is not readable narrower than that, so it scrolls inside
  // its own card. That wrapper never got the chance to scroll: a grid item and
  // a `<figure>` both default to `min-width: auto`, which means "at least as
  // wide as my content". Each ancestor grew to fit the 420 px table instead of
  // constraining it, and the overflow container was never narrower than what it
  // contained, so it had nothing to scroll.
  //
  // This is BUG-6 from liveQa.regression.test.jsx returning in a new component:
  // flex and grid children that were not allowed to shrink below their content.
  // jsdom computes no layout, so — as that suite does for the same class of
  // defect — this is asserted against the source.
  const showcaseSrc = readFileSync(
    join(process.cwd(), 'src', 'pages', 'landing', 'ProductShowcase.jsx'),
    'utf8'
  );
  const landingSrc = readFileSync(join(process.cwd(), 'src', 'pages', 'Landing.jsx'), 'utf8');

  test('the showcase root may shrink below its content', () => {
    expect(/<figure className="[^"]*\bmin-w-0\b/.test(showcaseSrc)).toBe(true);
  });

  test('the grid item holding the showcase may shrink below its content', () => {
    expect(/<Reveal className="[^"]*\bmin-w-0\b[^"]*">\s*<ProductShowcase/.test(landingSrc)).toBe(
      true
    );
  });

  test('the wide table still scrolls inside its own container', () => {
    // The fix must not have been applied by removing the min-width from the
    // table, which would fix the overflow by making the table unreadable.
    expect(/min-w-\[420px\]/.test(showcaseSrc)).toBe(true);
    const wrapper = showcaseSrc.indexOf('overflow-x-auto');
    const table = showcaseSrc.indexOf('min-w-[420px]');
    expect(wrapper).toBeGreaterThan(-1);
    expect(wrapper).toBeLessThan(table);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('reduced motion is respected', () => {
  // Reveal starts its children at opacity-0 and fades them in when an
  // IntersectionObserver fires. That is a real accessibility hazard if it is
  // ever the only thing that makes content visible: a visitor who has asked for
  // reduced motion would get a blank page.
  //
  // Both stubs below matter. Reporting `prefers-reduced-motion: reduce` alone
  // proves nothing in jsdom, because jsdom defines neither matchMedia nor
  // IntersectionObserver and Reveal already falls through to "visible" when
  // they are missing — the assertion would pass without the feature existing.
  // So IntersectionObserver is stubbed to a real object that never fires. The
  // only way the content can be visible is the reduced-motion branch.
  const observers = [];

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    window.IntersectionObserver = vi.fn().mockImplementation(function () {
      observers.push(this);
      this.observe = vi.fn();
      this.disconnect = vi.fn();
    });
  });

  afterEach(() => {
    observers.length = 0;
    delete window.matchMedia;
    delete window.IntersectionObserver;
  });

  test('content is visible without waiting for an animation that will not run', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Landing />
        </AuthProvider>
      </MemoryRouter>
    );

    const heading = await screen.findByRole('heading', { name: /run your personal training/i });
    expect(heading).toBeTruthy();

    // Every Reveal must have settled on the visible class, not the hidden one.
    const hidden = document.querySelectorAll('.opacity-0');
    expect(hidden.length).toBe(0);
    expect(document.querySelectorAll('.transition-all.opacity-100').length).toBeGreaterThan(0);
  });

  test('nothing was left waiting on an observer', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Landing />
        </AuthProvider>
      </MemoryRouter>
    );

    // Reduced motion short-circuits before an observer is ever constructed.
    expect(observers.length).toBe(0);
  });
});
