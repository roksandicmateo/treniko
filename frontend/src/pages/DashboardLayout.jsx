import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DpaAcceptanceModal from '../components/DpaAcceptanceModal';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SubscriptionBanner from '../components/SubscriptionBanner';
import ProfileMenu from '../components/ProfileMenu';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from 'react-i18next';

const DashboardLayout = () => {
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const { t } = useTranslation();
  const [dpaAccepted, setDpaAccepted] = useState(true);
  const [dpaLoading,  setDpaLoading]  = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkDpa = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/dpa-status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setDpaAccepted(res.data.dpa_accepted);
      } catch {
        setDpaAccepted(false);
      } finally {
        setDpaLoading(false);
      }
    };
    if (user) checkDpa();
    else setDpaLoading(false);
  }, [user]);

  const bottomNavItems = [
    { to: '/dashboard',           label: t('nav.dashboard'), icon: '🏠' },
    { to: '/dashboard/calendar',  label: t('nav.calendar'),  icon: '📅' },
    { to: '/dashboard/clients',   label: t('nav.clients'),   icon: '👥' },
    { to: '/dashboard/trainings', label: t('nav.trainings'), icon: '🏋️' },
    { to: '/dashboard/packages',  label: t('nav.packages'),  icon: '📦' },
  ];

  const allNavItems = [
    { to: '/dashboard',           label: t('nav.dashboard'), icon: '🏠' },
    { to: '/dashboard/calendar',  label: t('nav.calendar'),  icon: '📅' },
    { to: '/dashboard/trainings', label: t('nav.trainings'), icon: '🏋️' },
    { to: '/dashboard/clients',   label: t('nav.clients'),   icon: '👥' },
    { to: '/dashboard/packages',  label: t('nav.packages'),  icon: '📦' },
    { to: '/dashboard/exercises', label: t('nav.exercises'), icon: '💪' },
    { to: '/dashboard/groups',    label: t('nav.groups'),    icon: '🤝' },
  ];

  if (dpaLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {!dpaAccepted && <DpaAcceptanceModal onAccepted={() => setDpaAccepted(true)} />}

      {/* ── Header ── */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-xl sm:text-2xl font-bold text-primary-500 tracking-tight">TRENIKO</h1>
            <div className="flex items-center gap-2">
              {/* Language selector — compact dropdown */}
              <div className="hidden sm:block">
                <LanguageSelector compact />
              </div>
              {/* Dark mode toggle */}
              <button
                onClick={toggle}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={isDark ? t('profile.lightMode') : t('profile.darkMode')}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              <ProfileMenu />
            </div>
          </div>
        </div>
      </header>

      {/* ── Desktop top nav (hidden on mobile) ── */}
      <nav className="hidden sm:block bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-0 overflow-x-auto">
            {allNavItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-200 dark:hover:border-gray-700'
                  }`
                }
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 sm:pb-8">
        <SubscriptionBanner />
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-40 safe-area-pb transition-colors duration-200">
        <div className="flex">
          {bottomNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 pt-3 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-primary-500 dark:text-primary-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-xl mb-0.5 transition-transform ${isActive ? 'scale-110' : ''}`}>
                    {item.icon}
                  </span>
                  <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default DashboardLayout;
