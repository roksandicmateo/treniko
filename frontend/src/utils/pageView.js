/**
 * Anonymous page-view beacon.
 *
 * Sends one fire-and-forget signal per public page load so the funnel has a
 * denominator. `signup_attribution` can already say which Reel produced a
 * trainer; without this, nobody can say how many people that Reel sent who did
 * not sign up — and 2 signups from 10 visits versus 2 from 900 are not remotely
 * the same result.
 *
 * ── What this deliberately does not do ──────────────────────────────────────
 * It reads no storage and writes none: no cookie, no localStorage, no
 * sessionStorage, no visitor id, no fingerprint. It does not import
 * utils/attribution.js and does not touch anything that module stores.
 *
 * That is the reason it is not gated behind the cookie banner, and the reason
 * is a legal distinction rather than a convenience:
 *
 *   * attribution.js **writes to sessionStorage** — storing information on the
 *     visitor's device, ePrivacy Article 5(3) — so it requires consent and
 *     writes nothing without it.
 *   * this sends a request and stores nothing on the device at either end.
 *     There is no device storage or access to consent to.
 *
 * There is also a correctness reason, and it is not an excuse. Registrations
 * are counted unconditionally from `tenants`. If views were gated on consent
 * while registrations were not, every conversion rate would be a consented
 * sample divided into an unconsented total — overstated by exactly the share of
 * visitors who decline. That is not a rate; it is a number shaped like one.
 *
 * ── Honest limits ───────────────────────────────────────────────────────────
 * Refusing an identifier means views cannot be deduplicated: this counts page
 * VIEWS, not unique visitors, and one person reloading is two. Content blockers
 * will stop some requests. Both make the figure a floor rather than a census,
 * and the admin panel labels it accordingly.
 */

import { API_BASE_URL } from '../services/api';

/**
 * Built from the configured API base rather than a bare "/api/..." path.
 * A relative path resolves only when the site is served from the same origin
 * as the API — true today, and not something a beacon should silently depend
 * on. src/__tests__/product.regression.test.jsx enforces this for every source
 * file, after three of them shipped bare paths that 404'd off the dev proxy.
 */
const ENDPOINT = `${API_BASE_URL}/metrics/view`;

/** Public marketing routes only. The app and admin are never counted. */
const PUBLIC_PATHS = new Set(['/', '/privacy', '/terms', '/login', '/register']);

const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

/** Values come from a URL anyone can craft; the server caps them too. */
const MAX_LEN = 255;

const clean = (value) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_LEN) : null;

/**
 * Record a view of the current page, if it is a public one.
 *
 * Safe to call on every route change. Returns nothing and never throws — a
 * counter must not be able to break the page it is counting.
 */
export function recordPageView() {
  try {
    const path = window.location.pathname;
    if (!PUBLIC_PATHS.has(path)) return;

    const params = new URLSearchParams(window.location.search);
    const body = { path };

    for (const field of UTM_FIELDS) {
      const value = clean(params.get(field));
      if (value) body[field] = value;
    }

    // Host only. A full referrer can carry someone else's query string, and
    // trimming it here means the untrimmed value never leaves the browser.
    if (document.referrer) {
      try {
        const url = new URL(document.referrer);
        if (url.host && url.host !== window.location.host) {
          body.referrer_host = clean(url.host);
        }
      } catch {
        /* an unparseable referrer is simply not recorded */
      }
    }

    const payload = JSON.stringify(body);

    // sendBeacon survives the page being closed or navigated away from, which
    // is exactly when a bounce happens — the visits most worth counting are the
    // ones that leave immediately. It also cannot be awaited or inspected,
    // which suits a signal whose result nobody acts on.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }

    // Fetch fallback. keepalive for the same reason, and the promise is
    // swallowed: a failed count is not the visitor's problem.
    if (typeof fetch === 'function') {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Blocked, offline, or a locked-down browser. Never worth breaking a page.
  }
}
