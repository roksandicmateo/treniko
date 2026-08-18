/**
 * Formatting helpers for the admin panel.
 *
 * The panel is an internal staff tool and is deliberately English-only, so
 * these use a fixed `en-GB` locale rather than the trainer app's active i18n
 * language (see utils/locale.js for the customer-facing rule). A support person
 * reading a timestamp out loud to a colleague wants one unambiguous format,
 * not one that follows whoever last changed the language.
 */

const LOCALE = 'en-GB';

/** "18 Aug 2026", or an em dash when there is nothing to show. */
export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "18 Aug 2026, 14:05" — 24-hour, because this is an operations tool. */
export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(LOCALE, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
};

/** Whole number, or an em dash. `0` is a number and must survive. */
export const formatCount = (value) =>
  value === null || value === undefined ? '—' : Number(value).toLocaleString(LOCALE);

/** "5 / 50" or "5 / unlimited" — a null cap means no limit, not missing data. */
export const formatUsage = (used, max) =>
  `${formatCount(used)} / ${max === null || max === undefined ? 'unlimited' : formatCount(max)}`;

/** Badge class for a subscription status. */
export const statusBadge = (status) => {
  switch (status) {
    case 'active': return 'badge-green';
    case 'expired': return 'badge-red';
    case 'suspended': return 'badge-amber';
    case 'cancelled': return 'badge-gray';
    default: return 'badge-gray';
  }
};

/** A trainer is "locked" only while the lock is still in the future. */
export const isLocked = (lockedUntil) =>
  !!lockedUntil && new Date(lockedUntil) > new Date();
