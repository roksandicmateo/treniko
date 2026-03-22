import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DpaAcceptanceModal from '../components/DpaAcceptanceModal';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import SubscriptionBanner from '../components/SubscriptionBanner';
import ProfileMenu from '../components/ProfileMenu';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const [dpaAccepted, setDpaAccepted] = useState(true); // optimistic
  const [dpaLoading, setDpaLoading] = useState(true);

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
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { to: '/dashboard/calendar', label: 'Calendar', icon: '📅' },
    { to: '/dashboard/trainings', label: 'Trainings', icon: '🏋️' },
    { to: '/dashboard/clients', label: 'Clients', icon: '👥' },
    { to: '/dashboard/packages', label: 'Packages', icon: '📦' },
    { to: '/dashboard/exercises', label: 'Exercises', icon: '🏋️' },
  ];

  if (dpaLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {!dpaAccepted && <DpaAcceptanceModal onAccepted={() => setDpaAccepted(true)} />}
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary-600">TRENIKO</h1>
            </div>

            <ProfileMenu />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
            end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SubscriptionBanner /> {/* ← ADD THIS */}
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;