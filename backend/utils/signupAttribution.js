/**
 * Signup attribution — server side.
 *
 * ── The one rule this file exists to enforce ─────────────────────────────────
 * **A failure here can never fail a registration.** Attribution is marketing
 * metadata; the account is the product. Every path below is wrapped, logged and
 * swallowed, which is the same posture `recordAdminAction` takes in
 * adminController.js and for the same reason.
 *
 * ── The second rule: everything here is attacker-controlled ──────────────────
 * These values arrive in the registration request body, which anyone can craft.
 * That is not a hypothetical — /register is unauthenticated and public. So:
 *
 *   1. **Whitelist.** Only the eight known keys are read. An attribution object
 *      of `{ isAdmin: true }` or `{ tenant_id: '…' }` contributes nothing,
 *      because unknown keys are never looked at, let alone bound.
 *   2. **Truncate, do not reject.** Each value is capped at its column width.
 *      Rejecting an over-long value would let a hostile caller suppress
 *      attribution at will; truncating records what is useful and discards the
 *      rest. The VARCHAR(n) in migration 034 is the independent backstop.
 *   3. **Parameterised insert.** No value is ever concatenated into SQL.
 *
 * ── First touch is enforced by the schema, not here ──────────────────────────
 * `signup_attribution.tenant_id` is the PRIMARY KEY, so a second insert for a
 * tenant cannot succeed. `ON CONFLICT DO NOTHING` makes that a no-op rather
 * than an error, so a retried registration cannot produce a spurious log line.
 */

const { query } = require('../config/database');

/**
 * The eight accepted keys and the column width each is capped to. These widths
 * mirror migration 034 exactly — if one changes, change both.
 */
const FIELDS = {
  utm_source: 64,
  utm_medium: 64,
  utm_campaign: 64,
  utm_content: 128,
  utm_term: 128,
  referrer_host: 255,
  landing_path: 255,
};

/** ISO-8601 the browser sent for first touch. Anything unparseable is dropped. */
const cleanTimestamp = (value) => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  // A first-touch time in the future, or implausibly far past, is a broken or
  // spoofed clock rather than data. Record nothing rather than something wrong.
  const now = Date.now();
  if (ms > now + 60 * 60 * 1000) return null;
  if (ms < now - 365 * 24 * 60 * 60 * 1000) return null;
  return new Date(ms).toISOString();
};

/**
 * Reduce an arbitrary request-body value to the whitelisted, truncated set.
 * Exported for its own tests: this is where the security property lives, and it
 * is worth asserting without touching a database.
 *
 * @param {unknown} raw whatever arrived in `req.body.attribution`
 * @returns {object|null} a safe object, or null when there is nothing to record
 */
function sanitizeAttribution(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const out = {};
  for (const [field, max] of Object.entries(FIELDS)) {
    const value = raw[field];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[field] = trimmed.slice(0, max);
  }

  const firstSeen = cleanTimestamp(raw.first_seen_at);
  if (firstSeen) out.first_seen_at = firstSeen;

  // Nothing worth recording. Storing an empty row would make "arrived direct"
  // indistinguishable from "never captured", which is worse than no row at all.
  const hasSignal = Object.keys(out).some((k) => k !== 'first_seen_at');
  return hasSignal ? out : null;
}

/**
 * Record first-touch attribution for a newly created tenant.
 *
 * Never throws. Never rejects. Returns whether a row was written, which is for
 * tests and logging only — no caller should branch on it.
 *
 * @param {object} args
 * @param {string} args.tenantId  the tenant just created
 * @param {string} args.userId    the trainer just created
 * @param {unknown} args.raw      untrusted `req.body.attribution`
 * @returns {Promise<boolean>}
 */
async function recordSignupAttribution({ tenantId, userId, raw }) {
  try {
    const a = sanitizeAttribution(raw);
    if (!a) return false;

    await query(
      `INSERT INTO signup_attribution
         (tenant_id, user_id, utm_source, utm_medium, utm_campaign,
          utm_content, utm_term, referrer_host, landing_path, first_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [
        tenantId,
        userId || null,
        a.utm_source || null,
        a.utm_medium || null,
        a.utm_campaign || null,
        a.utm_content || null,
        a.utm_term || null,
        a.referrer_host || null,
        a.landing_path || null,
        a.first_seen_at || null,
      ]
    );
    return true;
  } catch (e) {
    // Loudly, because silent marketing data loss is how you end up trusting a
    // number that was never being collected. But swallowed, because a
    // registration must not fail over this.
    console.error('[attribution] FAILED to record signup attribution', e.message);
    return false;
  }
}

module.exports = { recordSignupAttribution, sanitizeAttribution, FIELDS };
