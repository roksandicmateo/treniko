import { useState, useEffect } from 'react';
import { subscriptionsAPI } from '../services/api';
import { format } from 'date-fns';
import { showToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const SubscriptionPage = () => {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [processing, setProcessing] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subResponse, plansResponse] = await Promise.all([
        subscriptionsAPI.getStatus(),
        subscriptionsAPI.getPlans()
      ]);
      setSubscription(subResponse.data.subscription);
      setPlans(plansResponse.data.plans);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (plan) => {
    setSelectedPlan(plan);
    setUpgradeModalOpen(true);
  };

  const confirmUpgrade = async () => {
    try {
      setProcessing(true);
      await subscriptionsAPI.changePlan(selectedPlan.id, billingPeriod);
      showToast(`Successfully ${selectedPlan.price_monthly > 0 ? 'upgraded' : 'changed'} to ${selectedPlan.display_name}!`, 'success');
      setUpgradeModalOpen(false);
      loadData();
    } catch (error) {
      const errorData = error.response?.data;
      
      if (errorData?.cannotDowngrade) {
        // Show detailed downgrade error
        showToast(errorData.message, 'error');
        setUpgradeModalOpen(false);
        
        // If it's a client limit issue, optionally show limit modal
        if (errorData.excessClients) {
          setTimeout(() => {
            alert(`You need to remove ${errorData.excessClients} client(s) before downgrading to ${selectedPlan.display_name}.`);
          }, 500);
        }
      } else {
        showToast(errorData?.message || 'Failed to change plan. Please try again.', 'error');
      }
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    setConfirmAction({
      title: 'Cancel Subscription',
      message: 'Are you sure you want to cancel your subscription? You will lose access at the end of your billing period.',
      onConfirm: performCancel,
      type: 'danger'
    });
    setConfirmModalOpen(true);
  };

  const performCancel = async () => {
    try {
      setProcessing(true);
      await subscriptionsAPI.cancelSubscription(true);
      showToast('Your subscription will be cancelled at the end of the billing period.', 'info');
      loadData();
    } catch (error) {
      showToast('Failed to cancel subscription.', 'error');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading subscription...</div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-lg">
          Failed to load subscription information
        </div>
      </div>
    );
  }

  const currentPlan = plans.find(p => p.name === subscription.plan_name);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Subscription</h1>

      {/* Current Plan Card */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Plan</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-4">
              <div className="text-sm text-gray-600">Plan</div>
              <div className="text-2xl font-bold text-gray-900">
                {subscription.plan_display_name}
                {subscription.is_trial && (
                  <span className="ml-2 text-sm font-normal text-blue-600">(Trial)</span>
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                €{parseFloat(subscription.price_monthly).toFixed(2)}/month
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-600">Status</div>
              <div className="text-lg font-semibold capitalize">
                {subscription.subscription_status === 'active' && (
                  <span className="text-green-600">✓ Active</span>
                )}
                {subscription.subscription_status === 'expired' && (
                  <span className="text-red-600">✗ Expired</span>
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-600">
                {subscription.is_trial ? 'Trial Ends' : 'Renews'}
              </div>
              <div className="text-lg font-semibold">
                {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({subscription.days_until_expiry} days)
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">Usage This Period</div>
            
            {/* Clients */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Clients</span>
                <span>
                  {subscription.clients_count}
                  {subscription.max_clients ? ` / ${subscription.max_clients}` : ' (unlimited)'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    subscription.clients_limit_reached ? 'bg-red-600' : 'bg-blue-600'
                  }`}
                  style={{
                    width: subscription.max_clients
                      ? `${Math.min((subscription.clients_count / subscription.max_clients) * 100, 100)}%`
                      : '0%'
                  }}
                />
              </div>
            </div>

            {/* Sessions */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Sessions This Month</span>
                <span>
                  {subscription.sessions_count}
                  {subscription.max_sessions_per_month ? ` / ${subscription.max_sessions_per_month}` : ' (unlimited)'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    subscription.sessions_limit_reached ? 'bg-red-600' : 'bg-green-600'
                  }`}
                  style={{
                    width: subscription.max_sessions_per_month
                      ? `${Math.min((subscription.sessions_count / subscription.max_sessions_per_month) * 100, 100)}%`
                      : '0%'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {subscription.plan_name !== 'enterprise' && (
          <div className="mt-6 pt-6 border-t">
            <button
              onClick={() => handleUpgrade(plans.find(p => p.name === 'pro') || plans.find(p => p.name === 'enterprise'))}
              className="btn-primary"
            >
              Upgrade Plan
            </button>
            {subscription.plan_name !== 'free' && (
              <button
                onClick={handleCancel}
                className="btn-secondary ml-3"
                disabled={processing}
              >
                Cancel Subscription
              </button>
            )}
          </div>
        )}
      </div>

      {/* Plans Comparison */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Available Plans</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.name === subscription.plan_name;
            
            return (
              <div
                key={plan.id}
                className={`border-2 rounded-lg p-6 ${
                  isCurrent ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
                }`}
              >
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{plan.display_name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">€{parseFloat(plan.price_monthly).toFixed(0)}</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  {plan.price_yearly > 0 && (
                    <div className="text-sm text-gray-600 mt-1">
                      or €{parseFloat(plan.price_yearly).toFixed(0)}/year (save 17%)
                    </div>
                  )}
                </div>

                {isCurrent && (
                  <div className="text-center mb-4">
                    <span className="inline-block px-3 py-1 bg-primary-600 text-white text-sm font-medium rounded-full">
                      Current Plan
                    </span>
                  </div>
                )}

                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">
                      {plan.max_clients ? `${plan.max_clients} clients` : 'Unlimited clients'}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">
                      {plan.max_sessions_per_month ? `${plan.max_sessions_per_month} sessions/month` : 'Unlimited sessions'}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className={`${plan.has_training_logs ? 'text-green-600' : 'text-gray-400'} mr-2`}>
                      {plan.has_training_logs ? '✓' : '✗'}
                    </span>
                    <span className="text-sm">Training logs</span>
                  </li>
                  <li className="flex items-start">
                    <span className={`${plan.has_analytics ? 'text-green-600' : 'text-gray-400'} mr-2`}>
                      {plan.has_analytics ? '✓' : '✗'}
                    </span>
                    <span className="text-sm">Analytics</span>
                  </li>
                  <li className="flex items-start">
                    <span className={`${plan.has_export ? 'text-green-600' : 'text-gray-400'} mr-2`}>
                      {plan.has_export ? '✓' : '✗'}
                    </span>
                    <span className="text-sm">Export data</span>
                  </li>
                  {plan.max_trainer_seats > 1 && (
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-sm">{plan.max_trainer_seats} trainer seats</span>
                    </li>
                  )}
                  {plan.has_api_access && (
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-sm">API access</span>
                    </li>
                  )}
                  {plan.has_custom_branding && (
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-sm">Custom branding</span>
                    </li>
                  )}
                  {plan.has_priority_support && (
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-sm">Priority support</span>
                    </li>
                  )}
                </ul>

                {!isCurrent && (
                  <button
                    onClick={() => handleUpgrade(plan)}
                    className="w-full btn-primary"
                    disabled={processing}
                  >
                    {plan.price_monthly > currentPlan?.price_monthly ? 'Upgrade' : 'Downgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Modal */}
      {upgradeModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Upgrade to {selectedPlan.display_name}
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Billing Period
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="billing"
                    value="monthly"
                    checked={billingPeriod === 'monthly'}
                    onChange={(e) => setBillingPeriod(e.target.value)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Monthly</div>
                    <div className="text-sm text-gray-600">
                      €{parseFloat(selectedPlan.price_monthly).toFixed(2)}/month
                    </div>
                  </div>
                </label>
                
                {selectedPlan.price_yearly > 0 && (
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="billing"
                      value="yearly"
                      checked={billingPeriod === 'yearly'}
                      onChange={(e) => setBillingPeriod(e.target.value)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        Yearly 
                        <span className="ml-2 text-green-600 text-sm">Save 17%</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        €{parseFloat(selectedPlan.price_yearly).toFixed(2)}/year
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="text-sm text-blue-900">
                <strong>What you get:</strong>
                <ul className="mt-2 space-y-1">
                  <li>• {selectedPlan.max_clients ? `${selectedPlan.max_clients} clients` : 'Unlimited clients'}</li>
                  <li>• {selectedPlan.max_sessions_per_month ? `${selectedPlan.max_sessions_per_month} sessions/month` : 'Unlimited sessions'}</li>
                  {selectedPlan.has_training_logs && <li>• Training logs</li>}
                  {selectedPlan.has_analytics && <li>• Analytics</li>}
                  {selectedPlan.has_export && <li>• Export data</li>}
                </ul>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setUpgradeModalOpen(false)}
                className="flex-1 btn-secondary"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={confirmUpgrade}
                className="flex-1 btn-primary"
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Confirm Upgrade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          onConfirm={confirmAction.onConfirm}
          title={confirmAction.title}
          message={confirmAction.message}
          type={confirmAction.type}
          confirmText="Yes, Cancel Subscription"
          cancelText="Keep Subscription"
        />
      )}
    </div>
  );
};

export default SubscriptionPage;
