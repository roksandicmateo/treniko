'use strict';

const { isUuid } = require('./validation');

/**
 * Ownership checks for client-supplied foreign keys (Phase 2B).
 *
 * A request body that names another row by id is an authorization decision, not
 * just data. Several endpoints inserted such ids straight into a child table:
 * the parent row (template, training) was correctly tenant-scoped, but the
 * referenced exercise id was written unchecked. Reading the record back joins
 * `exercises` without a tenant filter, so the response returned another
 * tenant's exercise name, category and unit — a genuine cross-tenant read
 * (TR-MED-4).
 */

/**
 * Verify every exercise id referenced by a payload belongs to `tenantId`.
 *
 * Null/undefined ids are allowed and skipped: both templates and trainings
 * support free-text exercises that carry a name instead of a catalogue
 * reference.
 *
 * @param {{query: Function}} db pool or checked-out client
 * @param {Array<{exerciseId?: string|null}>} exercises
 * @param {string} tenantId from the verified JWT — never from the request
 * @returns {Promise<{ok: true} | {ok: false, reason: string}>}
 */
const verifyExercisesOwned = async (db, exercises, tenantId) => {
  if (!Array.isArray(exercises) || exercises.length === 0) return { ok: true };

  const ids = [];
  for (const ex of exercises) {
    const id = ex?.exerciseId;
    if (id === undefined || id === null || id === '') continue;
    // A malformed id would otherwise reach Postgres and raise 22P02 as a 500.
    if (!isUuid(id)) return { ok: false, reason: 'Invalid exercise reference' };
    ids.push(id);
  }
  if (ids.length === 0) return { ok: true };

  const unique = [...new Set(ids)];
  const { rows } = await db.query(
    'SELECT id FROM exercises WHERE id = ANY($1::uuid[]) AND tenant_id = $2',
    [unique, tenantId]
  );

  if (rows.length !== unique.length) {
    // Same message whether the exercise is missing or owned by someone else —
    // the caller must not learn that another tenant's id exists.
    return { ok: false, reason: 'Unknown exercise reference' };
  }
  return { ok: true };
};

module.exports = { verifyExercisesOwned };
