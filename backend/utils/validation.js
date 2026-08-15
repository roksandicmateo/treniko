'use strict';

/**
 * Shared input-validation helpers.
 *
 * Added during Security Hardening Phase 2A.
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

module.exports = { isUuid };
