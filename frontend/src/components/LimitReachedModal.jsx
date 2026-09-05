import { useTranslation } from 'react-i18next';
import Icon from './Icon';

/**
 * The wall a trainer hits at the edge of their plan.
 *
 * ── What it used to say ──────────────────────────────────────────────────────
 * It was written in English inside an otherwise translated product, and it
 * offered "🚀 Upgrade Plan" — a button leading to a subscription page where
 * nothing can be bought, because there is no checkout anywhere in TRENIKO. A
 * dead end dressed as a call to action.
 *
 * During the beta the honest version is different: the limit is high enough
 * that a working trainer should not meet it (40 clients, migration 038), and if
 * they do, the useful thing is to hear from them. So it says what the limit is,
 * offers the one action that actually helps (pausing a client they no longer
 * train), and gives them a way to say they need more.
 */
const LimitReachedModal = ({ isOpen, onClose, limitType, currentCount, maxCount, planName }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const isClients = limitType === 'clients';
  const title = isClients ? t('subscription.clientLimitTitle') : t('subscription.sessionLimitTitle');
  const message = isClients
    ? t('subscription.clientLimitMessage', { max: maxCount, plan: planName })
    : t('subscription.sessionLimitMessage', { max: maxCount, plan: planName });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl"
      >
        <div className="flex items-start gap-3 mb-4">
          <Icon name="alert" className="h-6 w-6 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{message}</p>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-4 mb-5">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t('subscription.betaLimitHelp')}
          </p>
          <a
            href="mailto:info@treniko.com"
            className="mt-2 inline-block text-sm font-semibold text-sky-700 dark:text-sky-400 hover:underline"
          >
            info@treniko.com
          </a>
        </div>

        {isClients && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            {t('subscription.pauseInsteadHint')}
          </p>
        )}

        <button type="button" onClick={onClose} className="w-full btn-secondary">
          {t('common.close')}
        </button>
      </div>
    </div>
  );
};

export default LimitReachedModal;
