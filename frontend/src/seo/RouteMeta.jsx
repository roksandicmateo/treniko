/**
 * Per-route document metadata for a single-page app.
 *
 * ── Why this is needed ───────────────────────────────────────────────────────
 * index.html is one static <head> served at every path. Before the landing page
 * existed that was harmless, because the whole site was behind a login and the
 * file carried `noindex, nofollow` for all of it. Now `/` is a public marketing
 * page that must be indexable while `/login`, `/dashboard/*` and `/admin/*` must
 * not be — so the head has to change with the route.
 *
 * ── Two layers, deliberately ─────────────────────────────────────────────────
 * The static file is indexable and this component switches the private routes to
 * `noindex, nofollow` on navigation. That covers crawlers which execute JS.
 * A crawler that does *not* execute JS would see the static head at every path,
 * so `public/robots.txt` disallows the private paths outright. Neither layer is
 * trusted on its own, and they agree with each other; if you add a private
 * route, add it in both places.
 *
 * No dependency was added for this. react-helmet-async would be ~4 kB gzipped
 * and a provider around the whole tree to do what forty lines of DOM writes do,
 * on a page count in the low tens.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_ORIGIN = 'https://treniko.com';

const DEFAULT_TITLE = 'TRENIKO — Training Management Software for Personal Trainers';
const DEFAULT_DESCRIPTION =
  'TRENIKO keeps your clients, sessions, packages and payments in one place. Training management software for independent personal trainers.';

/**
 * The routes a search engine is welcome to index. Anything not listed here is
 * treated as private: `noindex, nofollow`, and no canonical URL.
 *
 * Keys are exact pathnames — the public surface is small and fixed, and an
 * exact map cannot accidentally match a dashboard route the way a prefix could.
 */
export const PUBLIC_ROUTES = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  '/privacy': {
    title: 'Privacy Policy — TRENIKO',
    description:
      'How TRENIKO collects, stores and processes personal data, and the rights you have over it.',
  },
  '/terms': {
    title: 'Terms of Service — TRENIKO',
    description:
      'The terms that apply to using TRENIKO: what the service does, what you are responsible for as the trainer, and how either side can end the agreement.',
  },
};

/** Titles for private routes. These are never indexed; they exist so the browser
 *  tab and history are readable rather than repeating the marketing title. */
const PRIVATE_TITLES = [
  [/^\/admin(\/|$)/, 'Admin — TRENIKO'],
  [/^\/dashboard(\/|$)/, 'Dashboard — TRENIKO'],
  [/^\/login$/, 'Log in — TRENIKO'],
  [/^\/register$/, 'Create your account — TRENIKO'],
  [/^\/forgot-password$/, 'Reset your password — TRENIKO'],
  [/^\/reset-password$/, 'Reset your password — TRENIKO'],
  [/^\/verify-email$/, 'Verify your email — TRENIKO'],
  [/^\/check-email$/, 'Check your email — TRENIKO'],
];

/** Upsert a <meta> tag by `name` or `property`. */
function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (href === null) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Applies the metadata for one pathname. Exported so the test suite can assert
 * on it directly without standing up a router.
 */
export function applyRouteMeta(pathname) {
  const publicPage = Object.prototype.hasOwnProperty.call(PUBLIC_ROUTES, pathname)
    ? PUBLIC_ROUTES[pathname]
    : null;

  if (publicPage) {
    document.title = publicPage.title;
    setMeta('name', 'description', publicPage.description);
    setMeta('name', 'robots', 'index, follow');
    // Canonical is built from a fixed origin and the matched key — never from
    // the live location — so a crafted URL cannot inject a canonical pointing
    // somewhere else.
    setCanonical(`${SITE_ORIGIN}${pathname === '/' ? '/' : pathname}`);
    setMeta('property', 'og:title', publicPage.title);
    setMeta('property', 'og:description', publicPage.description);
    setMeta('property', 'og:url', `${SITE_ORIGIN}${pathname === '/' ? '/' : pathname}`);
    return;
  }

  const match = PRIVATE_TITLES.find(([re]) => re.test(pathname));
  document.title = match ? match[1] : DEFAULT_TITLE;
  setMeta('name', 'robots', 'noindex, nofollow');
  setCanonical(null);
}

export default function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    applyRouteMeta(pathname);
  }, [pathname]);

  return null;
}
