import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DpaAcceptanceModal from '../components/DpaAcceptanceModal';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import SubscriptionBanner from '../components/SubscriptionBanner';
import ProfileMenu from '../components/ProfileMenu';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
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

  const handleLogout = () => { logout(); navigate('/login'); };

  // Bottom nav shows 5 items max on mobile — pick the most important
  const bottomNavItems = [
    { to: '/dashboard',          label: 'Home',      icon: '🏠' },
    { to: '/dashboard/calendar', label: 'Calendar',  icon: '📅' },
    { to: '/dashboard/clients',  label: 'Clients',   icon: '👥' },
    { to: '/dashboard/trainings',label: 'Trainings', icon: '🏋️' },
    { to: '/dashboard/packages', label: 'Packages',  icon: '📦' },
  ];

  const allNavItems = [
    { to: '/dashboard',           label: 'Dashboard', icon: '🏠' },
    { to: '/dashboard/calendar',  label: 'Calendar',  icon: '📅' },
    { to: '/dashboard/trainings', label: 'Trainings', icon: '🏋️' },
    { to: '/dashboard/exercises', label: 'Exercises', icon: '💪' },
    { to: '/dashboard/clients',   label: 'Clients',   icon: '👥' },
    { to: '/dashboard/groups', label: 'Groups', icon: '👥' },
    { to: '/dashboard/packages',  label: 'Packages',  icon: '📦' },
  ];

  if (dpaLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {!dpaAccepted && <DpaAcceptanceModal onAccepted={() => setDpaAccepted(true)} />}

      {/* ── Header ── */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-xl sm:text-2xl font-bold text-primary-600">TRENIKO</h1>
            <ProfileMenu />
          </div>
        </div>
      </header>

      {/* ── Desktop top nav (hidden on mobile) ── */}
      <nav className="hidden sm:block bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {allNavItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      {/* pb-20 on mobile to clear the bottom nav */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 sm:pb-8">
        <SubscriptionBanner />
        <Outlet />
      </main>

      {/* ── Mobile bottom nav (hidden on desktop) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
        <div className="flex">
          {bottomNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 pt-3 text-xs font-medium transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-xl mb-0.5 transition-transform ${isActive ? 'scale-110' : ''}`}>
                    {item.icon}
                  </span>
                  <span className={isActive ? 'text-primary-600 font-semibold' : ''}>
                    {item.label}
                  </span>
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
