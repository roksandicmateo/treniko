import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { subscriptionsAPI } from '../services/api';

const SubscriptionBanner = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const response = await subscriptionsAPI.getStatus();
      setSubscription(response.data.subscription);
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !subscription) return null;

  const daysLeft = subscription.days_until_expiry;
  const clientsPercentage = subscription.max_clients 
    ? Math.round((subscription.clients_count / subscription.max_clients) * 100)
    : 0;
  const sessionsPercentage = subscription.max_sessions_per_month
    ? Math.round((subscription.sessions_count / subscription.max_sessions_per_month) * 100)
    : 0;

  // Show warning if expiring soon
  if (daysLeft <= 7 && daysLeft > 0) {
    return (
      <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <div className="font-semibold text-yellow-900">
                Subscription expiring in {daysLeft} days
              </div>
              <div className="text-sm text-yellow-700">
                Renew your {subscription.plan_display_name} plan to avoid service interruption
              </div>
            </div>
          </div>
          <Link to="/dashboard/subscription" className="btn-primary whitespace-nowrap">
            Renew Now
          </Link>
        </div>
      </div>
    );
  }

  // Show error if expired
  if (subscription.is_read_only) {
    return (
      <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-3">🔒</span>
            <div>
              <div className="font-semibold text-red-900">
                Subscription Expired - Read-Only Mode
              </div>
              <div className="text-sm text-red-700">
                Your account is in read-only mode. Upgrade to restore full access.
              </div>
            </div>
          </div>
          <Link to="/dashboard/subscription" className="btn-primary whitespace-nowrap">
            Upgrade Now
          </Link>
        </div>
      </div>
    );
  }

  // Show usage warning if approaching limits
  if (clientsPercentage >= 80 || sessionsPercentage >= 80) {
    return (
      <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-semibold text-blue-900 mb-2">
              {subscription.plan_display_name} Plan - Approaching Limits
            </div>
            <div className="flex space-x-6 text-sm text-blue-700">
              <div>
                <strong>Clients:</strong> {subscription.clients_count}/{subscription.max_clients || '∞'}
                {clientsPercentage >= 80 && (
                  <span className="ml-2 text-blue-900 font-medium">({clientsPercentage}% used)</span>
                )}
              </div>
              <div>
                <strong>Sessions:</strong> {subscription.sessions_count}/{subscription.max_sessions_per_month || '∞'}
                {sessionsPercentage >= 80 && (
                  <span className="ml-2 text-blue-900 font-medium">({sessionsPercentage}% used)</span>
                )}
              </div>
            </div>
          </div>
          <Link to="/dashboard/subscription" className="btn-secondary whitespace-nowrap ml-4">
            Upgrade Plan
          </Link>
        </div>
      </div>
    );
  }

  // Show compact banner for normal usage
  return (
    <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-6 text-gray-600">
          <div>
            <strong className="text-gray-900">{subscription.plan_display_name} Plan</strong>
            {subscription.is_trial && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                Trial
              </span>
            )}
          </div>
          <div>
            Clients: <strong>{subscription.clients_count}/{subscription.max_clients || '∞'}</strong>
          </div>
          <div>
            Sessions: <strong>{subscription.sessions_count}/{subscription.max_sessions_per_month || '∞'}</strong>
          </div>
        </div>
        <Link to="/dashboard/subscription" className="text-primary-600 hover:text-primary-700 font-medium">
          Manage →
        </Link>
      </div>
    </div>
  );
};

export default SubscriptionBanner;
