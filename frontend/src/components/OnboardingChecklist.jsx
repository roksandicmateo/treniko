// frontend/src/components/OnboardingChecklist.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const DISMISSED_KEY = 'treniko_onboarding_dismissed';

export default function OnboardingChecklist() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [steps, setSteps]         = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === 'true') {
      setDismissed(true);
      return;
    }
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    // Query each resource directly so the check is accurate:
    // - clients: any active client exists
    // - packages: any package template exists (not just assigned ones)
    // - sessions: any session exists (including future scheduled ones)
    Promise.all([
      fetch(`${API_URL}/clients?isActive=true`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${API_URL}/packages`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${API_URL}/sessions?limit=1`, { headers }).then(r => r.json()).catch(() => ({})),
    ]).then(([clientsData, packagesData, sessionsData]) => {
      const hasClient  = (clientsData.clients?.length || 0) > 0;
      const hasPackage = (packagesData.packages?.length || 0) > 0;
      // sessions endpoint may return sessions array directly or nested
      const sessionList = sessionsData.sessions || sessionsData.data || [];
      const hasSession = sessionList.length > 0;

      const newSteps = [
        {
          id:     'client',
          label:  t('onboarding.addClient'),
          done:   hasClient,
          action: () => navigate('/dashboard/clients'),
          cta:    t('onboarding.goToClients'),
        },
        {
          id:     'package',
          label:  t('onboarding.createPackage'),
          done:   hasPackage,
          action: () => navigate('/dashboard/packages'),
          cta:    t('onboarding.goToPackages'),
        },
        {
          id:     'session',
          label:  t('onboarding.scheduleSession'),
          done:   hasSession,
          action: () => navigate('/dashboard/calendar'),
          cta:    t('onboarding.goToCalendar'),
        },
      ];
      setSteps(newSteps);
      if (newSteps.every(s => s.done)) {
        localStorage.setItem(DISMISSED_KEY, 'true');
        setDismissed(true);
      }
    }).catch(() => {});
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  if (dismissed || !steps) return null;

  const doneCount = steps.filter(s => s.done).length;
  const pct       = Math.round((doneCount / steps.length) * 100);
  const nextStep  = steps.find(s => !s.done);

  return (
    <div className="mb-6 bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900/40 rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🚀</span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('onboarding.title')}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {doneCount}/{steps.length} {t('onboarding.completed')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#0ea5e9" strokeWidth="3"
                strokeDasharray={`${pct * 0.88} 88`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
              {pct}%
            </span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); handleDismiss(); }}
            className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 text-xl leading-none"
            title={t('onboarding.dismiss')}
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 dark:bg-gray-800">
        <div className="h-full bg-blue-500 transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="px-5 py-4 space-y-3">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-3">
              {/* Checkbox */}
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                step.done
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}>
                {step.done && <span className="text-white text-xs font-bold">✓</span>}
                {!step.done && <span className="text-gray-400 dark:text-gray-500 text-xs font-semibold">{i + 1}</span>}
              </div>

              <p className={`flex-1 text-sm ${
                step.done
                  ? 'text-gray-400 dark:text-gray-500 line-through'
                  : 'text-gray-700 dark:text-gray-300 font-medium'
              }`}>
                {step.label}
              </p>

              {!step.done && (
                <button
                  onClick={step.action}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex-shrink-0"
                >
                  {step.cta} →
                </button>
              )}
            </div>
          ))}

          {nextStep && (
            <div className="pt-2">
              <button
                onClick={nextStep.action}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {t('onboarding.nextStep')}: {nextStep.label} →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
