// frontend/src/pages/DashboardPage.jsx  (NEW FILE)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const formatTime = (t) => t ? t.slice(0, 5) : '';

const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return diff;
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color }) => (
  <div className={`rounded-2xl p-5 ${color}`}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-2xl">{icon}</span>
    </div>
    <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>
    <p className="text-sm text-gray-500 mt-1">{label}</p>
  </div>
);

// ── Session row ───────────────────────────────────────────────────────────────
const SessionRow = ({ session, showDate = false, navigate }) => (
  <div
    onClick={() => navigate(`/dashboard/clients/${session.client_id}`)}
    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
  >
    <div className={`w-2 h-10 rounded-full flex-shrink-0 ${session.is_completed ? 'bg-green-400' : 'bg-blue-500'}`} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-800 truncate">
        {session.first_name} {session.last_name}
      </p>
      <p className="text-xs text-gray-400">
        {showDate ? `${formatDate(session.session_date)} · ` : ''}
        {formatTime(session.start_time)} – {formatTime(session.end_time)}
        {session.session_type ? ` · ${session.session_type}` : ''}
      </p>
    </div>
    {session.is_completed && (
      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">Done</span>
    )}
  </div>
);

// ── Package warning row ───────────────────────────────────────────────────────
const PackageWarningRow = ({ cp, navigate }) => {
  const days = daysUntil(cp.end_date);
  const sessionsLeft = cp.total_sessions != null ? cp.total_sessions - cp.sessions_used : null;

  const isUrgent = (days !== null && days <= 3) || (sessionsLeft !== null && sessionsLeft <= 1);

  return (
    <div
      onClick={() => navigate(`/dashboard/clients/${cp.client_id}`)}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
        isUrgent ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-yellow-50'
      }`}
    >
      <span className="text-xl flex-shrink-0">{isUrgent ? '🔴' : '🟡'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {cp.first_name} {cp.last_name}
        </p>
        <p className="text-xs text-gray-500 truncate">{cp.package_name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        {sessionsLeft !== null && (
          <p className={`text-xs font-semibold ${sessionsLeft <= 1 ? 'text-red-600' : 'text-yellow-700'}`}>
            {sessionsLeft} session{sessionsLeft !== 1 ? 's' : ''} left
          </p>
        )}
        {days !== null && (
          <p className={`text-xs ${days <= 3 ? 'text-red-600 font-semibold' : 'text-yellow-700'}`}>
            {days === 0 ? 'Expires today' : days < 0 ? 'Expired' : `${days}d left`}
          </p>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setData(d.dashboard); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-400 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const todaySessions = data?.todaySessions || [];
  const upcomingSessions = data?.upcomingSessions || [];
  const expiringPackages = data?.expiringPackages || [];
  const recentClients = data?.recentClients || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}, {user?.firstName}! 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Clients"      value={stats.active_clients}       icon="👥" color="bg-blue-50" />
        <StatCard label="Sessions Today"      value={stats.sessions_today}       icon="📅" color="bg-purple-50" />
        <StatCard label="Completed This Month" value={stats.completed_this_month} icon="✅" color="bg-green-50" />
        <StatCard label="Active Packages"     value={stats.active_packages}      icon="📦" color="bg-orange-50" />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Today's sessions — 2/3 width */}
        <div className="lg:col-span-2 space-y-6">

          {/* Today */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Today's Sessions</h2>
              <button
                onClick={() => navigate('/dashboard/calendar')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Open Calendar →
              </button>
            </div>
            {todaySessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">🌤️</p>
                <p className="text-sm text-gray-400">No sessions scheduled for today</p>
                <button
                  onClick={() => navigate('/dashboard/calendar')}
                  className="mt-3 text-xs text-blue-600 hover:underline"
                >
                  Schedule a session
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {todaySessions.map(s => (
                  <SessionRow key={s.id} session={s} navigate={navigate} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Upcoming — Next 7 Days</h2>
              <span className="text-xs text-gray-400">{upcomingSessions.length} sessions</span>
            </div>
            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No upcoming sessions this week</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {upcomingSessions.map(s => (
                  <SessionRow key={s.id} session={s} showDate navigate={navigate} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-6">

          {/* Expiring packages */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Package Alerts</h2>
              <button
                onClick={() => navigate('/dashboard/packages')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                All Packages →
              </button>
            </div>
            {expiringPackages.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-xs text-gray-400">All packages are healthy</p>
              </div>
            ) : (
              <div className="space-y-1">
                {expiringPackages.map(cp => (
                  <PackageWarningRow key={cp.id} cp={cp} navigate={navigate} />
                ))}
              </div>
            )}
          </div>

          {/* Recent clients */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Recent Clients</h2>
              <button
                onClick={() => navigate('/dashboard/clients')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                All Clients →
              </button>
            </div>
            {recentClients.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No clients yet</p>
            ) : (
              <div className="space-y-2">
                {recentClients.map(c => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                      {c.first_name?.[0]}{c.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        Added {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
