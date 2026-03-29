import { useState, useEffect } from 'react';
import { subscriptionsAPI } from '../services/api';
import { format } from 'date-fns';
import { showToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { useTranslation } from 'react-i18next';

const SubscriptionPage = () => {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [processing, setProcessing] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subResponse, plansResponse] = await Promise.all([
        subscriptionsAPI.getStatus(),
        subscriptionsAPI.getPlans()
      ]);
      setSubscription(subResponse.data.subscription);
      setPlans(plansResponse.data.plans);
    } catch (error) { console.error('Failed to load subscription data:', error); }
    finally { setLoading(false); }
  };

  const handleUpgrade = (plan) => { setSelectedPlan(plan); setUpgradeModalOpen(true); };

  const confirmUpgrade = async () => {
    try {
      setProcessing(true);
      await subscriptionsAPI.changePlan(selectedPlan.id, billingPeriod);
      showToast(`Upgraded to ${selectedPlan.display_name}!`, 'success');
      setUpgradeModalOpen(false);
      loadData();
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.cannotDowngrade) {
        showToast(errorData.message, 'error');
        setUpgradeModalOpen(false);
        if (errorData.excessClients) setTimeout(() => alert(`Remove ${errorData.excessClients} client(s) before downgrading.`), 500);
      } else { showToast(errorData?.message || t('common.error'), 'error'); }
    } finally { setProcessing(false); }
  };

  const handleCancel = () => {
    setConfirmAction({
      title: 'Cancel Subscription',
      message: 'Are you sure you want to cancel? You will lose access at the end of your billing period.',
      onConfirm: performCancel, type: 'danger'
    });
    setConfirmModalOpen(true);
  };

  const performCancel = async () => {
    try {
      setProcessing(true);
      await subscriptionsAPI.cancelSubscription(true);
      showToast('Subscription will be cancelled at the end of the billing period.', 'info');
      loadData();
    } catch { showToast(t('common.error'), 'error'); }
    finally { setProcessing(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400">{t('common.loading')}</div>;
  if (!subscription) return <div className="max-w-4xl mx-auto"><div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl">{t('common.error')}</div></div>;

  const currentPlan = plans.find(p => p.name === subscription.plan_name);

  const cardClass = "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('subscription.title')}</h1>

      {/* Current Plan */}
      <div className={cardClass}>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('subscription.currentPlan')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Plan</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {subscription.plan_display_name}
                {subscription.is_trial && <span className="ml-2 text-sm font-normal text-primary-500">(Trial)</span>}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">€{parseFloat(subscription.price_monthly).toFixed(2)}/month</div>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
              <div className="text-lg font-semibold">
                {subscription.subscription_status === 'active' && <span className="text-green-600 dark:text-green-400">✓ Active</span>}
                {subscription.subscription_status === 'expired' && <span className="text-red-600 dark:text-red-400">✗ Expired</span>}
              </div>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">{subscription.is_trial ? 'Trial Ends' : 'Renews'}</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">({subscription.days_until_expiry} days)</span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Usage This Period</div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1 text-gray-600 dark:text-gray-400">
                <span>Clients</span>
                <span>{subscription.clients_count}{subscription.max_clients ? ` / ${subscription.max_clients}` : ' (unlimited)'}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className={`h-2 rounded-full ${subscription.clients_limit_reached ? 'bg-red-500' : 'bg-primary-500'}`}
                  style={{ width: subscription.max_clients ? `${Math.min((subscription.clients_count / subscription.max_clients) * 100, 100)}%` : '0%' }} />
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1 text-gray-600 dark:text-gray-400">
                <span>Sessions This Month</span>
                <span>{subscription.sessions_count}{subscription.max_sessions_per_month ? ` / ${subscription.max_sessions_per_month}` : ' (unlimited)'}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className={`h-2 rounded-full ${subscription.sessions_limit_reached ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: subscription.max_sessions_per_month ? `${Math.min((subscription.sessions_count / subscription.max_sessions_per_month) * 100, 100)}%` : '0%' }} />
              </div>
            </div>
          </div>
        </div>
        {subscription.plan_name !== 'enterprise' && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 flex gap-3">
            <button onClick={() => handleUpgrade(plans.find(p => p.name === 'pro') || plans.find(p => p.name === 'enterprise'))} className="btn-primary">
              {t('subscription.renewNow')}
            </button>
            {subscription.plan_name !== 'free' && (
              <button onClick={handleCancel} className="btn-secondary" disabled={processing}>Cancel Subscription</button>
            )}
          </div>
        )}
      </div>

      {/* Plans */}
      <div className={cardClass}>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => {
            const isCurrent = plan.name === subscription.plan_name;
            return (
              <div key={plan.id} className={`border-2 rounded-2xl p-6 ${isCurrent ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{plan.display_name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">€{parseFloat(plan.price_monthly).toFixed(0)}</span>
                    <span className="text-gray-500 dark:text-gray-400">/month</span>
                  </div>
                  {plan.price_yearly > 0 && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">or €{parseFloat(plan.price_yearly).toFixed(0)}/year (save 17%)</div>}
                </div>
                {isCurrent && (
                  <div className="text-center mb-4">
                    <span className="inline-block px-3 py-1 bg-primary-500 text-white text-sm font-medium rounded-full">{t('subscription.currentPlan')}</span>
                  </div>
                )}
                <ul className="space-y-2 mb-6 text-sm">
                  {[
                    plan.max_clients ? `${plan.max_clients} clients` : 'Unlimited clients',
                    plan.max_sessions_per_month ? `${plan.max_sessions_per_month} sessions/month` : 'Unlimited sessions',
                  ].map(item => <li key={item} className="flex items-start gap-2"><span className="text-green-500">✓</span><span className="text-gray-600 dark:text-gray-400">{item}</span></li>)}
                  {[
                    { key: 'has_training_logs', label: 'Training logs' },
                    { key: 'has_analytics', label: 'Analytics' },
                    { key: 'has_export', label: 'Export data' },
                  ].map(f => (
                    <li key={f.key} className="flex items-start gap-2">
                      <span className={plan[f.key] ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}>{plan[f.key] ? '✓' : '✗'}</span>
                      <span className={`${plan[f.key] ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>{f.label}</span>
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <button onClick={() => handleUpgrade(plan)} className="w-full btn-primary" disabled={processing}>
                    {plan.price_monthly > currentPlan?.price_monthly ? 'Upgrade' : 'Downgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade modal */}
      {upgradeModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Upgrade to {selectedPlan.display_name}</h2>
            <div className="mb-6 space-y-2">
              <label className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <input type="radio" name="billing" value="monthly" checked={billingPeriod === 'monthly'} onChange={e => setBillingPeriod(e.target.value)} className="mr-3" />
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-200">Monthly</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">€{parseFloat(selectedPlan.price_monthly).toFixed(2)}/month</div>
                </div>
              </label>
              {selectedPlan.price_yearly > 0 && (
                <label className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input type="radio" name="billing" value="yearly" checked={billingPeriod === 'yearly'} onChange={e => setBillingPeriod(e.target.value)} className="mr-3" />
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">Yearly <span className="text-green-500 text-sm ml-1">Save 17%</span></div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">€{parseFloat(selectedPlan.price_yearly).toFixed(2)}/year</div>
                  </div>
                </label>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setUpgradeModalOpen(false)} className="flex-1 btn-secondary" disabled={processing}>{t('common.cancel')}</button>
              <button onClick={confirmUpgrade} className="flex-1 btn-primary" disabled={processing}>{processing ? t('common.loading') : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmModal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)}
          onConfirm={confirmAction.onConfirm} title={confirmAction.title}
          message={confirmAction.message} type={confirmAction.type}
          confirmText="Yes, Cancel" cancelText="Keep Subscription" />
      )}
    </div>
  );
};

export default SubscriptionPage;
