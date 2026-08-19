/**
 * First-touch signup attribution — capture only.
 *
 * ── Scope, and why it stops where it does ────────────────────────────────────
 * `marketing/social/ANALYTICS_IMPLEMENTATION.md` designs attribution in five
 * steps and rates them individually. This file is step 3, the one that plan
 * marks "pure client — no risk". Steps 4 and 5 (merging attribution into the
 * register payload, and migration 034 to persist it) are deliberately NOT here:
 * step 5 touches the registration path, which is the most important flow in the
 * product, and it needs a schema change, a production backup and its own
 * rollback plan. Shipping that alongside a marketing page would be two
 * unrelated risks in one deploy.
 *
 * On its own this module records nothing server-side. What it buys is the one
 * thing that is otherwise lost forever: the UTM parameters exist only in the
 * URL of the landing page, and by the time someone reaches /register they are
 * gone. Capturing them now means the day migration 034 ships, the value is
 * already sitting in sessionStorage waiting to be read.
 *
 * ── Rules taken from that plan, unchanged ────────────────────────────────────
 * - **First touch wins.** Written once per tab, never overwritten. The Reel that
 *   made someone look is worth crediting; a direct visit later is not new.
 * - **`sessionStorage`, never `localStorage`, never a cookie.** It dies with the
 *   tab and is never a cross-site identifier.
 * - **Trim in the browser.** The referrer is reduced to its host and the landing
 *   URL to its path *before* anything is stored, so the untrimmed value never
 *   leaves the page.
 * - **Gated on consent.** The plan says: "if a cookie banner is ever added for
 *   any other reason, gate this behind it too." One exists — CookieBanner.jsx —
 *   so this writes nothing until the visitor has accepted the analytics
 *   category. No consent, no storage, no exceptions.
 *
 * Everything here is wrapped: storage can throw in private modes and behind
 * strict browser settings, and a marketing page must not blank out over it.
 */

const STORAGE_KEY = 'treniko_attribution';
const CONSENT_KEY = 'treniko_cookie_consent';

/** Fields copied from the query string, in the project's UTM convention. */
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

/** Values arrive from a URL anyone can craft, so every one is length-capped. */
const MAX_LEN = 120;

const clean = (value) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_LEN) : null;

/**
 * True only when the visitor has actively accepted the analytics category.
 * Absent, malformed or rejected consent all read as "no".
 */
export function hasAnalyticsConsent() {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.analytics === true;
  } catch {
    return false;
  }
}

/** The stored first-touch attribution, or null if there is none. */
export function getAttribution() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Reads the current URL and referrer and stores them once.
 *
 * Safe to call as often as you like: it returns early if consent is missing, if
 * something is already stored, or if the visit carries nothing worth recording.
 * Call it on the landing page and again when a CTA is pressed — the second call
 * catches the common case where someone accepts the banner after arriving.
 *
 * @returns {object|null} the attribution now in storage, or null
 */
export function captureAttribution() {
  try {
    if (!hasAnalyticsConsent()) return null;

    const existing = getAttribution();
    if (existing) return existing;

    const params = new URLSearchParams(window.location.search);
    const record = {};
    for (const field of UTM_FIELDS) {
      const value = clean(params.get(field));
      if (value) record[field] = value;
    }

    // Instagram rewrites outbound links through l.instagram.com, so the
    // referrer identifies the channel even when the UTM tags never made it —
    // which is what happens when somebody types the domain after seeing a Reel.
    // Host only: a full referrer can carry someone else's query string.
    let referrerHost = null;
    if (document.referrer) {
      try {
        const url = new URL(document.referrer);
        if (url.host && url.host !== window.location.host) referrerHost = clean(url.host);
      } catch {
        /* an unparseable referrer is simply not recorded */
      }
    }
    if (referrerHost) record.referrer_host = referrerHost;

    // Nothing to attribute: no tags and no external referrer. Storing an empty
    // record would only make "direct" indistinguishable from "never captured".
    if (Object.keys(record).length === 0) return null;

    // Path only — the query string is where the UTMs already are, and recording
    // it as well would store them twice.
    record.landing_path = window.location.pathname.slice(0, MAX_LEN);
    record.first_seen_at = new Date().toISOString();

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return record;
  } catch {
    // Storage disabled, quota exhausted, or a locked-down browser. Attribution
    // is never worth breaking a page over.
    return null;
  }
}
