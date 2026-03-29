// src/components/LanguageSelector.jsx
import { useTranslation } from 'react-i18next';

// ── To add a new language: add one entry here ────────────────────────────────
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'hr', label: 'Hrvatski', flag: '🇭🇷' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
];

export default function LanguageSelector({ compact = false }) {
  const { i18n } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  const change = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('treniko_language', code);
  };

  if (compact) {
    // Dropdown version for ProfileMenu
    return (
      <select
        value={i18n.language}
        onChange={e => change(e.target.value)}
        className="text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {SUPPORTED_LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
        ))}
      </select>
    );
  }

  // Full pill buttons version for ProfilePage
  return (
    <div className="flex gap-2 flex-wrap">
      {SUPPORTED_LANGUAGES.map(l => (
        <button
          key={l.code}
          onClick={() => change(l.code)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${
            i18n.language === l.code
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <span className="text-base">{l.flag}</span>
          {l.label}
        </button>
      ))}
    </div>
  );
}
