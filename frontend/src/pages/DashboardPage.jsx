// frontend/src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import SessionModal from '../components/SessionModal';
import { StatsSkeleton, SessionListSkeleton, CardSkeleton } from '../components/SkeletonLoader';
import OnboardingChecklist from '../components/OnboardingChecklist';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const formatTime = (t) => t ? t.slice(0, 5) : '';

const formatDate = (d, locale) => {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  const today    = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString())    return locale === 'hr' ? 'Danas' : locale === 'de' ? 'Heute' : 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return locale === 'hr' ? 'Sutra' : locale === 'de' ? 'Morgen' : 'Tomorrow';
  return date.toLocaleDateString(locale === 'hr' ? 'hr-HR' : locale === 'de' ? 'de-DE' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
};

const STATUS_COLORS = {
  completed: 'bg-green-400',
  cancelled: 'bg-gray-400',
  no_show:   'bg-red-400',
  scheduled: 'bg-blue-500',
};

const StatCard = ({ label, value, icon, color }) => (
  <div className={`rounded-2xl p-5 ${color} dark:opacity-90`}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-2xl">{icon}</span>
    </div>
    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value ?? '—'}</p>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
  </div>
);

const SessionRow = ({ session, showDate = false, onSessionClick, locale }) => (
  <div onClick={() => onSessionClick(session)}
    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
    <div className={`w-2 h-10 rounded-full flex-shrink-0 ${STATUS_COLORS[session.status] || 'bg-blue-500'}`} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
        {session.first_name} {session.last_name}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {showDate ? `${formatDate(session.session_date, locale)} · ` : ''}
        {formatTime(session.start_time)} – {formatTime(session.end_time)}
        {session.session_type ? ` · ${session.session_type}` : ''}
      </p>
    </div>
    {session.status === 'completed' && <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full flex-shrink-0">✓</span>}
    {session.status === 'cancelled' && <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">—</span>}
    {session.status === 'no_show'   && <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full flex-shrink-0">✗</span>}
  </div>
);

const PackageWarningRow = ({ cp, navigate, t, locale }) => {
  const days = daysUntil(cp.end_date);
  const sessionsLeft = cp.total_sessions != null ? cp.total_sessions - cp.sessions_used : null;
  const isUrgent = (days !== null && days <= 3) || (sessionsLeft !== null && sessionsLeft <= 1);

  return (
    <div onClick={() => navigate(`/dashboard/clients/${cp.client_id}`)}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isUrgent ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' : 'hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}>
      <span className="text-xl flex-shrink-0">{isUrgent ? '🔴' : '🟡'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{cp.first_name} {cp.last_name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{cp.package_name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        {sessionsLeft !== null && (
          <p className={`text-xs font-semibold ${sessionsLeft <= 1 ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {sessionsLeft} {t('packages.sessionsRemaining')}
          </p>
        )}
        {days !== null && (
          <p className={`text-xs ${days <= 3 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-amber-700 dark:text-amber-400'}`}>
            {days === 0 ? t('packages.expiresToday') : days < 0 ? t('packages.expired') : `${days} ${t('packages.daysLeft')}`}
          </p>
        )}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [data,            setData]            = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [modalOpen,       setModalOpen]       = useState(false);

  const loadDashboard = () => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d.dashboard); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadDashboard(); }, []);

  const handleSessionClick = (session) => {
    setSelectedSession({
      id: session.id, clientId: session.client_id,
      sessionDate: session.session_date,
      startTime: session.start_time, endTime: session.end_time,
      sessionType: session.session_type, notes: session.notes,
      isCompleted: session.is_completed, status: session.status,
      clientName: `${session.first_name} ${session.last_name}`,
    });
    setModalOpen(true);
  };

  const handleSessionSaved = () => {
    setModalOpen(false);
    setSelectedSession(null);
    setLoading(true);
    loadDashboard();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.greeting_morning');
    if (h < 17) return t('dashboard.greeting_afternoon');
    return t('dashboard.greeting_evening');
  };

  const locale = i18n.language;

  const dateStr = new Date().toLocaleDateString(
    locale === 'hr' ? 'hr-HR' : locale === 'de' ? 'de-DE' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      <StatsSkeleton />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
        </div>
        <div className="space-y-6">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </div>
  );

  const stats            = data?.stats            || {};
  const todaySessions    = data?.todaySessions    || [];
  const upcomingSessions = data?.upcomingSessions || [];
  const expiringPackages = data?.expiringPackages || [];
  const recentClients    = data?.recentClients    || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {greeting()}, {user?.firstName}! 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 capitalize">{dateStr}</p>
      </div>

      <OnboardingChecklist />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.activeClients')}    value={stats.active_clients}       icon="👥" color="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard label={t('dashboard.sessionsToday')}    value={stats.sessions_today}       icon="📅" color="bg-purple-50 dark:bg-purple-900/20" />
        <StatCard label={t('dashboard.completedMonth')}   value={stats.completed_this_month} icon="✅" color="bg-green-50 dark:bg-green-900/20" />
        <StatCard label={t('dashboard.activePackages')}   value={stats.active_packages}      icon="📦" color="bg-orange-50 dark:bg-orange-900/20" />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Today's sessions */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.todaySessions')}</h2>
              <button onClick={() => navigate('/dashboard/calendar')}
                className="text-xs text-primary-500 hover:text-primary-600 font-medium">
                {t('dashboard.openCalendar')}
              </button>
            </div>
            {todaySessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">🌤️</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">{t('dashboard.noSessionsToday')}</p>
                <button onClick={() => navigate('/dashboard/calendar')}
                  className="mt-3 text-xs text-primary-500 hover:underline">
                  {t('dashboard.scheduleSession')}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {todaySessions.map(s => (
                  <SessionRow key={s.id} session={s} onSessionClick={handleSessionClick} locale={locale} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.upcomingWeek')}</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">{upcomingSessions.length} {t('dashboard.sessions')}</span>
            </div>
            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">{t('dashboard.noUpcoming')}</p>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {upcomingSessions.map(s => (
                  <SessionRow key={s.id} session={s} showDate onSessionClick={handleSessionClick} locale={locale} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Package alerts */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.packageAlerts')}</h2>
              <button onClick={() => navigate('/dashboard/packages')}
                className="text-xs text-primary-500 hover:text-primary-600 font-medium">
                {t('dashboard.allPackages')}
              </button>
            </div>
            {expiringPackages.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('dashboard.allPackagesHealthy')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {expiringPackages.map(cp => (
                  <PackageWarningRow key={cp.id} cp={cp} navigate={navigate} t={t} locale={locale} />
                ))}
              </div>
            )}
          </div>

          {/* Recent clients */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.recentClients')}</h2>
              <button onClick={() => navigate('/dashboard/clients')}
                className="text-xs text-primary-500 hover:text-primary-600 font-medium">
                {t('dashboard.allClients')}
              </button>
            </div>
            {recentClients.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">{t('clients.noClients')}</p>
            ) : (
              <div className="space-y-2">
                {recentClients.map(c => (
                  <div key={c.id} onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold flex-shrink-0">
                      {c.first_name?.[0]}{c.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t('dashboard.added')} {new Date(c.created_at).toLocaleDateString(
                          locale === 'hr' ? 'hr-HR' : locale === 'de' ? 'de-DE' : 'en-GB',
                          { day: 'numeric', month: 'short' }
                        )}
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

      {modalOpen && (
        <SessionModal
          session={selectedSession}
          initialDate={null} initialTime={null}
          onClose={() => { setModalOpen(false); setSelectedSession(null); }}
          onSave={handleSessionSaved}
        />
      )}
    </div>
  );
};

export default DashboardPage;
