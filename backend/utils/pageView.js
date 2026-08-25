/**
 * Anonymous page-view recording — migration 035.
 *
 * ── The rules, which are the same two as signup attribution ──────────────────
 * 1. **It can never break the page.** The endpoint answers 204 whether or not
 *    the row was written. A visitor must never see an error, and a failure here
 *    must never surface in the browser, because this is a counter and the page
 *    is the product.
 * 2. **Everything arriving is attacker-controlled.** /api/metrics/view is
 *    public and unauthenticated by necessity — it fires before anyone has an
 *    account. So the same posture applies: whitelist the known keys, truncate
 *    to the column width, bind as parameters, and never read an unknown field.
 *
 * ── What this refuses to do ─────────────────────────────────────────────────
 * It does not receive, derive or store an IP address, a user agent, a cookie or
 * any visitor identifier. The client sends a path, a referrer host and campaign
 * labels; the server records exactly those and the time. There is deliberately
 * nothing here that could single anyone out or join two views together.
 *
 * That is also why the referrer host is taken from the request body rather than
 * the `Referer` header: the browser trims it to a host before sending, so the
 * untrimmed value never reaches the server at all. A hostile caller could of
 * course lie about it — but a hostile caller could equally send a fake header,
 * and the failure mode is a wrong marketing number, not a security hole.
 */

const { query } = require('../config/database');

/** Accepted keys and their column widths. Mirrors migration 035. */
const FIELDS = {
  path: 255,
  referrer_host: 255,
  utm_source: 64,
  utm_medium: 64,
  utm_campaign: 64,
  utm_content: 128,
};

/**
 * Reduce an arbitrary request body to the whitelisted, truncated set.
 * Exported for its own tests — this is where the security property lives.
 *
 * @param {unknown} raw the request body
 * @returns {object|null} a safe object, or null when there is no usable path
 */
function sanitizePageView(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const out = {};
  for (const [field, max] of Object.entries(FIELDS)) {
    const value = raw[field];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[field] = trimmed.slice(0, max);
  }

  // A view without a path is not a view of anything. Reject rather than store
  // a row that can never be attributed to a page.
  if (!out.path) return null;

  // Defence in depth: the client only ever sends public marketing routes, but
  // the endpoint is public, so a caller could post anything. A path must look
  // like a path — no protocol, no host, no traversal — or the table becomes a
  // place to write arbitrary strings that later get rendered in an admin panel.
  //
  // The dot is permitted so that file downloads can be counted: the free
  // tracker at /downloads/treniko-client-session-tracker.xlsx is served off
  // disk by nginx and never reaches the application, so a click beacon is the
  // only way to know anyone took it. Without the dot those events were being
  // silently dropped here, which is the correct behaviour for unexpected input
  // and the wrong answer for a path we deliberately send.
  //
  // `..` stays rejected on its own line below. It is the only reason the dot
  // was excluded in the first place, and widening the class without restoring
  // that check would trade a measurement for a traversal.
  if (!/^\/[A-Za-z0-9/._-]*$/.test(out.path)) return null;

  // Two things the character class used to reject only as a side effect of
  // excluding the dot. Both are restored explicitly, because a property that
  // holds by accident stops holding the moment the accident is edited — which
  // is exactly what happened when the dot was permitted, and what the test
  // suite caught.
  //
  // `..` is traversal.
  if (out.path.includes('..')) return null;
  // `//host` is a protocol-relative URL. It is not a path: a browser resolves
  // it against the current scheme and lands on another origin, so anywhere the
  // admin panel renders one of these as a link it becomes an off-site
  // redirect wearing a local-looking value.
  if (out.path.startsWith('//')) return null;

  return out;
}

/**
 * Record one page view. Never throws, never rejects.
 *
 * @param {unknown} raw the request body
 * @returns {Promise<boolean>} whether a row was written; for tests and logging
 */
async function recordPageView(raw) {
  try {
    const v = sanitizePageView(raw);
    if (!v) return false;

    await query(
      `INSERT INTO page_view
         (path, referrer_host, utm_source, utm_medium, utm_campaign, utm_content)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        v.path,
        v.referrer_host || null,
        v.utm_source || null,
        v.utm_medium || null,
        v.utm_campaign || null,
        v.utm_content || null,
      ]
    );
    return true;
  } catch (e) {
    // Loud in the log, invisible to the visitor. Silent loss of marketing data
    // is how you end up trusting a number nobody was collecting.
    console.error('[pageView] FAILED to record page view', e.message);
    return false;
  }
}

module.exports = { recordPageView, sanitizePageView, FIELDS };
