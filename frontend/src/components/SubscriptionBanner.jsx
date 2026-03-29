import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { subscriptionsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const SubscriptionBanner = () => {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSubscription(); }, []);

  const loadSubscription = async () => {
    try {
      const response = await subscriptionsAPI.getStatus();
      setSubscription(response.data.subscription);
    } catch (err) { console.error('Failed to load subscription:', err); }
    finally { setLoading(false); }
  };

  if (loading || !subscription) return null;

  const daysLeft = subscription.days_until_expiry;
  const clientsPct = subscription.max_clients
    ? Math.round((subscription.clients_count / subscription.max_clients) * 100) : 0;
  const sessionsPct = subscription.max_sessions_per_month
    ? Math.round((subscription.sessions_count / subscription.max_sessions_per_month) * 100) : 0;

  // Expiring soon
  if (daysLeft <= 7 && daysLeft > 0) {
    return (
      <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-semibold text-yellow-900 dark:text-yellow-400">
                {t('subscription.expiringDays', { count: daysLeft })}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-500">
                {t('subscription.avoidInterruption', { plan: subscription.plan_display_name })}
              </div>
            </div>
          </div>
          <Link to="/dashboard/subscription" className="btn-primary whitespace-nowrap text-sm">
            {t('subscription.renewNow')}
          </Link>
        </div>
      </div>
    );
  }

  // Expired / read-only
  if (subscription.is_read_only) {
    return (
      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 rounded-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <div className="font-semibold text-red-900 dark:text-red-400">{t('packages.expired')} — Read-Only</div>
              <div className="text-sm text-red-700 dark:text-red-500">
                {t('subscription.avoidInterruption', { plan: subscription.plan_display_name })}
              </div>
            </div>
          </div>
          <Link to="/dashboard/subscription" className="btn-primary whitespace-nowrap text-sm">
            {t('subscription.renewNow')}
          </Link>
        </div>
      </div>
    );
  }

  // Approaching limits
  if (clientsPct >= 80 || sessionsPct >= 80) {
    return (
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="font-semibold text-blue-900 dark:text-blue-400 mb-1">
              {subscription.plan_display_name} Plan — {t('subscription.approachingLimits')}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-blue-700 dark:text-blue-400">
              <div>
                <strong>{t('subscription.clients')}:</strong> {subscription.clients_count}/{subscription.max_clients || '∞'}
                {clientsPct >= 80 && <span className="ml-1 font-medium">({clientsPct}% {t('subscription.used')})</span>}
              </div>
              <div>
                <strong>{t('subscription.sessions')}:</strong> {subscription.sessions_count}/{subscription.max_sessions_per_month || '∞'}
                {sessionsPct >= 80 && <span className="ml-1 font-medium">({sessionsPct}% {t('subscription.used')})</span>}
              </div>
            </div>
          </div>
          <Link to="/dashboard/subscription" className="btn-secondary whitespace-nowrap text-sm ml-4">
            {t('subscription.upgradePlan')}
          </Link>
        </div>
      </div>
    );
  }

  // Compact normal banner
  return (
    <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center flex-wrap gap-x-5 gap-y-1 text-gray-600 dark:text-gray-400">
          <div>
            <strong className="text-gray-900 dark:text-gray-200">{subscription.plan_display_name} Plan</strong>
            {subscription.is_trial && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full">Trial</span>
            )}
          </div>
          <div>{t('subscription.clients')}: <strong>{subscription.clients_count}/{subscription.max_clients || '∞'}</strong></div>
          <div>{t('subscription.sessions')}: <strong>{subscription.sessions_count}/{subscription.max_sessions_per_month || '∞'}</strong></div>
        </div>
        <Link to="/dashboard/subscription" className="text-primary-500 hover:text-primary-600 font-medium whitespace-nowrap ml-4">
          Manage →
        </Link>
      </div>
    </div>
  );
};

export default SubscriptionBanner;
