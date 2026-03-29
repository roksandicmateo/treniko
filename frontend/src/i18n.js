// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hr from './locales/hr.json';
import de from './locales/de.json';

// ── To add a new language in the future ─────────────────────────────────────
// 1. Create src/locales/xx.json (copy en.json and translate)
// 2. Import it here: import xx from './locales/xx.json';
// 3. Add to resources below: xx: { translation: xx }
// 4. Add to SUPPORTED_LANGUAGES in src/components/LanguageSelector.jsx
// That's it — detection and switching work automatically.
// ────────────────────────────────────────────────────────────────────────────

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hr: { translation: hr },
      de: { translation: de },
    },
    fallbackLng: 'en',
    detection: {
      // Check localStorage key first, then browser language
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'treniko_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
