'use strict';

/**
 * One definition of "today", and it belongs to the trainer.
 *
 * ── The defect this exists to prevent ────────────────────────────────────────
 * Three parts of the product each decided what day it was, and each asked a
 * different clock: the dashboard asked the Node process, the client detail page
 * asked PostgreSQL, the browser asked the viewer's machine. They agree only
 * while all three sit in the same zone, which is true today and stops being
 * true the moment the API moves to a UTC host — at which point "today's
 * sessions" empties out at 22:00 in Zagreb and shows yesterday's list until
 * 02:00. Nothing about that failure looks like a bug from the inside; the
 * screen simply shows the wrong day.
 *
 * ── Why the conversion is done in SQL ────────────────────────────────────────
 * `NOW() AT TIME ZONE 'Europe/Zagreb'` uses PostgreSQL's own zone database,
 * which knows every historical and future DST rule and is updated with the
 * server. Doing the same thing in JavaScript means either Intl string parsing
 * or a date library — a new dependency for something the database already does
 * correctly. This is the same reasoning as utils/wallClock.js.
 */

const { pool } = require('../config/database');

const DEFAULT_TIMEZONE = 'Europe/Zagreb';

/**
 * The trainer's configured zone, falling back to the default when the user row
 * is gone or the column is somehow empty. Never throws: a missing zone must
 * degrade to a sensible day, not to a 500 on the dashboard.
 *
 * @param {string} userId
 * @returns {Promise<string>} an IANA zone name
 */
const getTrainerTimezone = async (userId) => {
  if (!userId) return DEFAULT_TIMEZONE;
  try {
    const { rows } = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
    return rows[0]?.timezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

/**
 * SQL expression for the trainer's current calendar date.
 *
 * Written as a fragment rather than a value so a query can compare dates in the
 * database instead of round-tripping a string: `WHERE session_date = ${TODAY}`.
 * The zone arrives as a bound parameter — never interpolated — because it comes
 * from a column a user can set.
 *
 * @param {number} paramIndex position of the timezone parameter, e.g. 2 for $2
 */
const todaySql = (paramIndex) => `((NOW() AT TIME ZONE $${paramIndex})::date)`;

/**
 * The trainer's current calendar date as "YYYY-MM-DD".
 *
 * @param {string} timezone IANA zone name
 * @returns {Promise<string>}
 */
const todayFor = async (timezone) => {
  const { rows } = await pool.query(
    'SELECT ((NOW() AT TIME ZONE $1)::date)::text AS today',
    [timezone || DEFAULT_TIMEZONE]
  );
  return rows[0].today;
};

/**
 * Is this a zone PostgreSQL recognises? Used to validate profile input before
 * it reaches the CHECK constraint, so the trainer gets a message rather than a
 * 500.
 *
 * @param {unknown} timezone
 * @returns {Promise<boolean>}
 */
const isKnownTimezone = async (timezone) => {
  if (typeof timezone !== 'string' || timezone.length === 0 || timezone.length > 64) return false;
  const { rows } = await pool.query(
    'SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = $1) AS ok',
    [timezone]
  );
  return rows[0].ok === true;
};

module.exports = { DEFAULT_TIMEZONE, getTrainerTimezone, todaySql, todayFor, isKnownTimezone };
