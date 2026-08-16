/**
 * Wall-clock date and time helpers.
 *
 * A training's start and end are the times the trainer typed. The API stores
 * and returns them as zone-less strings — "2026-08-18T09:00:00", never
 * "…09:00:00.000Z" (see backend/utils/wallClock.js) — and this module is the
 * one place that reads and writes that form.
 *
 * ── What went wrong before ───────────────────────────────────────────────────
 * The form's helpers did `new Date(value).toISOString().slice(11, 16)`. That
 * round trip converts a local time to UTC, so in Europe/Zagreb a training
 * entered at 09:00 reopened in the form at 07:00 while the detail page showed
 * 11:00 — the same value, wrong in two directions at once. It also broke twice
 * a year, because the offset it silently applied is not constant.
 *
 * Reading the string has no offset to apply and no DST rule to trip over, which
 * is why these functions do not construct a Date unless the value genuinely is
 * an absolute instant.
 */

// Anchored at both ends on purpose: a value carrying a zone designator
// ("…T09:00:00.000Z", "…+02:00") is an instant, not a wall clock, and must fall
// through to the Date branch rather than have its digits read off.
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?$/;

const pad = (n) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" for a Date, in the viewer's own zone. */
export const localDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "HH:MM" for a Date, in the viewer's own zone. */
export const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * The calendar date of a wall-clock value.
 *
 * Falls back to today — deliberately via local getters, not
 * `toISOString().slice(0, 10)`, which returns yesterday's date for the last
 * hours of every evening east of Greenwich.
 */
export const toDatePart = (value) => {
  if (!value) return localDate(new Date());
  const m = String(value).match(WALL_CLOCK);
  if (m) return m[1];
  const d = new Date(value);               // an instant: show its local day
  return Number.isNaN(d.getTime()) ? localDate(new Date()) : localDate(d);
};

/** The "HH:MM" of a wall-clock value, defaulting to 09:00. */
export const toTimePart = (value) => {
  if (!value) return '09:00';
  const m = String(value).match(WALL_CLOCK);
  if (m) return m[2] || '09:00';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '09:00' : localTime(d);
};

/** One hour later, clamped to the end of the day. */
export const addHourTime = (timeStr) => {
  if (!timeStr) return '10:00';
  const [h, m] = timeStr.split(':').map(Number);
  return `${pad(Math.min(h + 1, 23))}:${pad(m)}`;
};

/**
 * The value to send back to the API: a date and a time, joined, with no zone.
 */
export const toWallClock = (date, time) => `${date}T${time}:00`;
