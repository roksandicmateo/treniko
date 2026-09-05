/**
 * Dates and times, formatted once and the same way everywhere.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Every screen formatted its own. The dashboard hardcoded "Danas"/"Sutra" per
 * language inside a JS ternary — outside the translation files entirely, so
 * adding a language meant editing components. Locale selection was repeated as
 * `locale === 'hr' ? 'hr-HR' : locale === 'de' ? 'de-DE' : 'en-GB'` in six
 * places, each one a chance to forget a language.
 *
 * The API sends calendar dates as "YYYY-MM-DD" and wall-clock times as
 * "HH:MM:SS", both already in the trainer's own zone (see backend
 * utils/wallClock.js and utils/trainerTime.js). Nothing here converts between
 * zones, because there is nothing to convert: these are the values the trainer
 * typed.
 */

const LOCALES = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE' };

/** The BCP-47 tag for an i18next language, defaulting to English. */
export const localeFor = (language) => LOCALES[language] || LOCALES.en;

/** "18:00:00" → "18:00". An empty value formats as an empty string, not "Invalid". */
export const formatTime = (value) => (value ? String(value).slice(0, 5) : '');

/**
 * Parse "YYYY-MM-DD" without letting the browser guess.
 * `new Date("2026-08-20")` is parsed as UTC midnight and renders as the 19th
 * west of Greenwich; building the parts explicitly keeps it a calendar date.
 */
const parseCalendarDate = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/** Today, as a calendar date in the viewer's own clock. */
const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Whole days from today to `value`; negative for the past. */
export const daysFromToday = (value) => {
  const date = parseCalendarDate(value);
  if (!date) return null;
  return Math.round((date - startOfToday()) / 86400000);
};

/**
 * A date the way a person says it: "Today", "Tomorrow", "Yesterday", or a short
 * date. The three words come from the translation files rather than from a
 * ternary in a component.
 */
export const formatDayLabel = (value, locale, t) => {
  const date = parseCalendarDate(value);
  if (!date) return '';
  const diff = daysFromToday(value);
  if (diff === 0)  return t('common.today');
  if (diff === 1)  return t('common.tomorrow');
  if (diff === -1) return t('common.yesterday');
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
};

/** "20. kolovoza 2026." style — for headers, not for lists. */
export const formatLongDate = (value, locale) => {
  const date = parseCalendarDate(value);
  if (!date) return '';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
};

/** "20. kol" style — compact, for table cells and chips. */
export const formatShortDate = (value, locale) => {
  const date = parseCalendarDate(value);
  if (!date) return '';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
};

/**
 * Money, in the currency the record carries.
 * `Intl` gets the separator and symbol placement right per locale, which a
 * template string never does: 350,50 € in Croatian, €350.50 in English.
 */
export const formatMoney = (amount, currency = 'EUR', locale = 'hr-HR') => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
};
