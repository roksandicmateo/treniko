/**
 * The BCP 47 locale that dates and numbers should be formatted in.
 *
 * ── What went wrong ──────────────────────────────────────────────────────────
 * The clients table formatted its "last session" date with
 * `toLocaleDateString(undefined, …)`. Passing `undefined` does not mean "the
 * app's language" — it means the *runtime's* default locale, i.e. whatever the
 * browser or OS is set to. On a machine set to Croatian, an English UI rendered
 * "18. kol" next to English column headers, and switching the language in the
 * app changed nothing at all, because i18next was never consulted.
 *
 * The app already had the right mapping, written inline as the same ternary in
 * five different pages. This module is that mapping, in one place, so a screen
 * can ask for the active locale instead of re-deriving it.
 */

import { useTranslation } from 'react-i18next';

/**
 * i18next language -> the locale its dates should be formatted in.
 * Matches the mapping the pages already used (en -> en-GB, not en-US).
 */
const LOCALE_BY_LANGUAGE = {
  en: 'en-GB',
  hr: 'hr-HR',
  de: 'de-DE',
};

/** Mirrors i18next's `fallbackLng: 'en'` (see src/i18n.js). */
export const DEFAULT_DATE_LOCALE = 'en-GB';

/**
 * Resolve an i18next language to a formatting locale.
 *
 * Region-tagged values are matched on their base language, so both 'en' and
 * the 'en-US' a browser detector may hand back resolve to the same locale.
 *
 * @param {string} [language] e.g. 'hr', 'en-GB'
 * @returns {string} a BCP 47 locale tag
 */
export const resolveDateLocale = (language) => {
  if (!language) return DEFAULT_DATE_LOCALE;
  const base = String(language).toLowerCase().split('-')[0];
  return LOCALE_BY_LANGUAGE[base] || DEFAULT_DATE_LOCALE;
};

/**
 * The active formatting locale, tracking the language the user has selected.
 *
 * Built on useTranslation so the component re-renders on `languageChanged` —
 * a table that has already rendered must not stay stuck in the previous
 * language's format after the user switches.
 *
 * @returns {string} a BCP 47 locale tag
 */
export const useDateLocale = () => {
  const { i18n } = useTranslation();
  return resolveDateLocale(i18n.language);
};
