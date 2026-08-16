'use strict';

/**
 * Wall-clock serialisation for `trainings.start_time` / `trainings.end_time`.
 *
 * ── The defect this exists to prevent ────────────────────────────────────────
 * Live QA entered a training at 09:00 on 18 Aug and the detail page showed
 * 11:00 — the Europe/Zagreb UTC offset, added twice over.
 *
 * Both columns are `TIMESTAMP WITHOUT TIME ZONE`, and what they hold is the
 * trainer's wall-clock time: the frontend posts "2026-08-18T09:00:00" and
 * PostgreSQL stores exactly that, with no zone attached. Nothing is wrong with
 * the stored value.
 *
 * The damage happened on the way out. node-postgres parses a zone-less
 * timestamp into a JS Date by interpreting it in the SERVER's time zone, and
 * `JSON.stringify` then writes that Date as an absolute instant — on a UTC
 * production server, "2026-08-18T09:00:00.000Z". The browser reads an instant
 * and renders it in the trainer's zone: 11:00. A naive local time was promoted
 * to an absolute one, and the promotion was invented by the transport.
 *
 * ── Why the formatting is done in SQL ────────────────────────────────────────
 * The obvious repair — take the Date node-postgres produced and read its local
 * components back — recovers the stored value only while the server's zone has
 * no DST transitions. Run the API in Europe/Zagreb and a training at 02:30 on
 * the spring-forward Sunday has no valid local representation, so the round
 * trip cannot be exact. `to_char` never leaves the database's own text form, so
 * it is correct in every zone and across every transition; there is no instant
 * for a DST rule to act on.
 *
 * ── The contract ─────────────────────────────────────────────────────────────
 * The API returns "YYYY-MM-DDTHH:mm:ss" with no zone suffix. Per ECMA-262 a
 * date-time string without an offset is parsed as LOCAL time, so
 * `new Date(start_time)` in the browser yields the wall clock the trainer
 * typed, and `toLocaleString` renders it unchanged — in any zone, on either
 * side of a DST boundary.
 *
 * Calendar sessions (`training_sessions`) are unaffected and always were: they
 * store a DATE and two TIME columns, which have no instant to misinterpret.
 */

/** Postgres format string producing the contract above. */
const WALL_CLOCK_FORMAT = `'YYYY-MM-DD"T"HH24:MI:SS'`;

/**
 * SELECT list fragment adding the wall-clock forms of a trainings row.
 *
 * Deliberately aliased to `*_wall` rather than shadowing `start_time` in the
 * projection: two output columns of the same name would leave which one wins to
 * the driver's row-building order. `applyWallClock` then does the substitution
 * in one visible place.
 *
 * @param {string} alias table alias used in the query, e.g. 't'
 */
const wallClockSelect = (alias = 't') =>
  `to_char(${alias}.start_time, ${WALL_CLOCK_FORMAT}) AS start_time_wall, ` +
  `to_char(${alias}.end_time,   ${WALL_CLOCK_FORMAT}) AS end_time_wall`;

/**
 * Replace the driver-parsed timestamps with the wall-clock strings.
 *
 * Mutates and returns the row (rows come straight from the driver and are not
 * shared), and is a no-op on a row that carries no `*_wall` columns, so it is
 * safe to apply to any result set.
 *
 * @template {Record<string, any>} T
 * @param {T} row
 * @returns {T}
 */
const applyWallClock = (row) => {
  if (!row || typeof row !== 'object') return row;
  if ('start_time_wall' in row) {
    row.start_time = row.start_time_wall;
    delete row.start_time_wall;
  }
  if ('end_time_wall' in row) {
    row.end_time = row.end_time_wall;
    delete row.end_time_wall;
  }
  return row;
};

/** @param {Array} rows */
const applyWallClockToAll = (rows) => (Array.isArray(rows) ? rows.map(applyWallClock) : rows);

module.exports = { wallClockSelect, applyWallClock, applyWallClockToAll, WALL_CLOCK_FORMAT };
