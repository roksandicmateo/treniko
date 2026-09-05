// frontend/src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import SessionModal from '../components/SessionModal';
import { StatsSkeleton, SessionListSkeleton, CardSkeleton } from '../components/SkeletonLoader';
import OnboardingChecklist from '../components/OnboardingChecklist';
import AttentionPanel from '../components/AttentionPanel';
import Icon from '../components/Icon';
import { formatDayLabel, formatTime, localeFor } from '../utils/datetime';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const STATUS_COLORS = {
  completed: 'bg-emerald-400',
  cancelled: 'bg-gray-300 dark:bg-gray-600',
  no_show:   'bg-red-400',
  scheduled: 'bg-sky-500',
};

/**
 * A counter. Deliberately quiet: these four numbers do not change a decision,
 * and they used to sit at the top of the screen in four coloured cards, above
 * everything that does. They are kept because they are cheap and orienting —
 * one line of text, below the work.
 */
const Stat = ({ label, value }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value ?? '—'}</span>
    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
  </div>
);

const SessionRow = ({ session, showDate = false, onSessionClick, locale, t }) => (
  <button
    type="button"
    onClick={() => onSessionClick(session)}
    className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
  >
    <span className={`w-1.5 h-10 rounded-full flex-shrink-0 ${STATUS_COLORS[session.status] || STATUS_COLORS.scheduled}`} />
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
        {session.is_group
          ? (session.group_title || t('sessions.adhocGroup'))
          : `${session.first_name} ${session.last_name}`}
      </span>
      <span className="block text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {showDate ? `${formatDayLabel(session.session_date, locale, t)} · ` : ''}
        {formatTime(session.start_time)}–{formatTime(session.end_time)}
        {session.session_type ? ` · ${session.session_type}` : ''}
      </span>
    </span>
    {session.status === 'completed' && <Icon name="check" className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />}
    {session.status === 'no_show'   && <Icon name="x" className="h-4 w-4 text-red-500 flex-shrink-0" />}
  </button>
);

const Panel = ({ title, action, children }) => (
  <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const LinkButton = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
  >
    {children}
    <Icon name="arrowR" className="h-3.5 w-3.5" />
  </button>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [data,            setData]            = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [modalOpen,       setModalOpen]       = useState(false);
  const [loadError,       setLoadError]       = useState('');

  // A failed load used to fall through to the normal dashboard with `data`
  // still null, which renders empty panels: the screen for "everything is fine
  // and you have no clients yet" was identical to the screen for "we could not
  // reach the server". Say which.
  const loadDashboard = () => {
    const token = localStorage.getItem('token');
    setLoadError('');
    fetch(`${API_URL}/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(d => { setData(d.dashboard); setLoading(false); })
      .catch(() => { setLoadError(t('common.error')); setLoading(false); });
  };

  useEffect(() => { loadDashboard(); }, []);

  const openSession = (session) => {
    setSelectedSession({
      id: session.id, clientId: session.client_id,
      sessionDate: session.session_date,
      startTime: session.start_time, endTime: session.end_time,
      sessionType: session.session_type, notes: session.notes,
      isCompleted: session.is_completed, status: session.status,
      clientName: `${session.first_name} ${session.last_name}`,
      isGroup: session.is_group, groupTitle: session.group_title,
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

  const locale = localeFor(i18n.language);
  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      <CardSkeleton lines={4} />
      <div className="grid lg:grid-cols-2 gap-5">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
      <StatsSkeleton />
    </div>
  );

  const stats            = data?.stats            || {};
  const todaySessions    = data?.todaySessions    || [];
  const upcomingSessions = data?.upcomingSessions || [];
  const attention        = data?.attention        || null;

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {greeting()}, {user?.firstName}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 first-letter:uppercase">{dateStr}</p>
      </header>

      {loadError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-2xl px-5 py-4 text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><Icon name="alert" className="h-4 w-4" />{loadError}</span>
          <button
            onClick={() => { setLoading(true); loadDashboard(); }}
            className="text-xs font-semibold underline whitespace-nowrap"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      <OnboardingChecklist />

      {/* ── What needs doing ──────────────────────────────────────────────────
          First, and visually loudest. The trainer opening this between two
          sessions is asking one question, and it is not "how many clients do I
          have". */}
      <AttentionPanel attention={attention} onSessionClick={openSession} onChanged={loadDashboard} />

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Today */}
        <Panel
          title={t('dashboard.todaySessions')}
          action={<LinkButton onClick={() => navigate('/dashboard/calendar')}>{t('dashboard.openCalendar')}</LinkButton>}
        >
          {todaySessions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.noSessionsTodayShort')}</p>
              <button
                onClick={() => navigate('/dashboard/calendar')}
                className="mt-2 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
              >
                {t('dashboard.scheduleSession')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 -mx-1">
              {todaySessions.map(s => (
                <SessionRow key={s.id} session={s} onSessionClick={openSession} locale={locale} t={t} />
              ))}
            </div>
          )}
        </Panel>

        {/* The week ahead */}
        <Panel
          title={t('dashboard.upcomingWeek')}
          action={<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {t('counts.session', { count: upcomingSessions.length })}
          </span>}
        >
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">{t('dashboard.noUpcoming')}</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 -mx-1">
              {upcomingSessions.map(s => (
                <SessionRow key={s.id} session={s} showDate onSessionClick={openSession} locale={locale} t={t} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── The counters ──────────────────────────────────────────────────────
          Kept, but last and quiet. */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          {t('dashboard.statsTitle')}
        </h2>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <Stat label={t('dashboard.activeClients')}  value={stats.active_clients} />
          <Stat label={t('dashboard.sessionsToday')}  value={stats.sessions_today} />
          <Stat label={t('dashboard.completedMonth')} value={stats.completed_this_month} />
          <Stat label={t('dashboard.activePackages')} value={stats.active_packages} />
        </div>
      </section>

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
