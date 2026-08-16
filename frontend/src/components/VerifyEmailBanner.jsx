import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

// Replaces the hard /check-email redirect (see PrivateRoute.jsx). An unverified
// trainer can work, and is reminded rather than locked out. Dismissal lasts for
// the browser session only — closing it silences the reminder for the task at
// hand without letting it disappear for good.
const DISMISS_KEY = 'treniko_verify_banner_dismissed';

const VerifyEmailBanner = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1'
  );

  // Shown only when the API positively says the address is unverified. An
  // undefined value means "not reported", which must not be read as a problem.
  if (dismissed || user?.emailVerified !== false) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-base leading-none mt-0.5">✉️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {t('auth.verifyEmailTitle')}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 break-words">
            {t('auth.verifyEmailBody', { email: user?.email || '' })}
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label={t('common.close')}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 text-xl leading-none flex-shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default VerifyEmailBanner;
