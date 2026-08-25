/**
 * Build-time prerender entry for the public homepage.
 *
 * ── The problem this solves ──────────────────────────────────────────────────
 * The application is a client-rendered SPA, so the HTML served at `/` was an
 * empty `<div id="root">`. Google executes JavaScript, but on a second pass
 * with a rendering budget a brand-new domain does not command — and Bing,
 * DuckDuckGo, most AI crawlers and most link-preview bots do not execute it at
 * all. The homepage is the page every external link points at, and it was the
 * one page with nothing in it.
 *
 * ── Why this shape, and not a framework ──────────────────────────────────────
 * No Next.js, no Remix, no SSR server, no new hosting. This renders **once, at
 * build time**, into a static file that nginx already knows how to serve. There
 * is no runtime cost, nothing new to keep alive, and if this file were deleted
 * tomorrow the site would keep working exactly as it does today — it would just
 * go back to being invisible to non-JS crawlers.
 *
 * `react-dom/server` is part of react-dom, which is already a dependency, and
 * the SSR bundle is produced by Vite's existing `--ssr` mode. **Nothing new was
 * installed.**
 *
 * ── Why the tree below is not <App /> ────────────────────────────────────────
 * App mounts `BrowserRouter` (needs `window`) and `ThemeProvider`, whose
 * `useState` initialiser reads `localStorage` and `matchMedia` during render —
 * that throws in Node. Landing does not use the theme context, and neither
 * provider emits any DOM, so rendering the smaller tree produces byte-identical
 * markup to what the client produces on its first pass.
 *
 * That equality is the whole contract, and it is what makes hydration silent:
 *
 *   client first render at `/`  →  Toast(null) · RouteMeta(null) ·
 *                                  PageViewTracker(null) · CookieBanner(null) ·
 *                                  Landing
 *   this file                   →  Landing
 *
 * Every one of those returns `null` on its first render — Toast because its
 * list is empty, CookieBanner because it reads consent in an effect, the other
 * two by construction. If any of them ever starts rendering markup on first
 * paint, hydration here will warn, and that warning is the signal to update
 * this comment rather than to silence it.
 *
 * AuthProvider *is* included: Landing calls `useAuth()`, and it is SSR-safe —
 * its state starts `{ user: null, loading: true }` and it touches storage only
 * inside an effect. A crawler therefore gets the signed-out page, which is the
 * correct one to index.
 */

import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import Landing from './pages/Landing';
import { AuthProvider } from './context/AuthContext';

/**
 * Re-exported so the build step can write each public SPA route's <head> from
 * the same table RouteMeta applies at runtime. Two hand-maintained copies of a
 * canonical URL is how they end up disagreeing.
 */
export { PUBLIC_ROUTES, SITE_ORIGIN } from './seo/RouteMeta';

/**
 * @returns {string} the markup for the inside of `<div id="root">`
 */
export function render() {
  return renderToString(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    </AuthProvider>
  );
}
