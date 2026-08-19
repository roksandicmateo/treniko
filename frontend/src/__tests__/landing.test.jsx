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
import { render, screen, cleanup, within } from '@testing-library/react';
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

  test('every navigation target on the page is a same-origin absolute path', async () => {
    renderApp('/');

    for (const a of screen.getAllByRole('link')) {
      const href = a.getAttribute('href') || '';
      // mailto: is the one deliberate exception — the contact address.
      if (href.startsWith('mailto:')) continue;
      if (href.startsWith('#')) continue;

      expect(href.startsWith('/')).toBe(true);
      // '//host' and '/\host' both resolve off-origin in a browser.
      expect(href.startsWith('//')).toBe(false);
      expect(href.startsWith('/\\')).toBe(false);
      expect(new URL(href, 'https://treniko.com').origin).toBe('https://treniko.com');
    }
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

  test('it does not advertise a price the product cannot charge', () => {
    // There is no payment processor in the codebase, so the only figure the page
    // is allowed to show is the free plan's zero.
    const src = source();
    const amounts = [...src.matchAll(/€\s*([\d.,]+)/g)].map((m) => m[1]);
    expect(amounts.every((a) => Number(a.replace(',', '.')) === 0)).toBe(true);
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
