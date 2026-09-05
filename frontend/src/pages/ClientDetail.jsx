// frontend/src/pages/ClientDetail.jsx
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from '../components/training/AddTrainingModal';
import ProgressChart from '../components/progress/ProgressChart';
import StrengthProgress from '../components/progress/StrengthProgress';
import AssignPackageModal from '../components/AssignPackageModal';
import ClientNotesTab from '../components/ClientNotesTab';
import PRSummary from '../components/progress/PRSummary';
import BillingTab from '../components/BillingTab';
import ConfirmModal from '../components/ConfirmModal';
import ClientSummaryHeader from '../components/ClientSummaryHeader';
import PackageAdjustPanel from '../components/PackageAdjustPanel';
import SessionModal from '../components/SessionModal';
import Icon from '../components/Icon';
import { useDateLocale } from '../utils/locale';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Five, not seven. `notes` was a tab of its own for two text fields that
// belong on the profile, and `prs` was a second progress tab showing the same
// client's numbers from a different angle — so "progress" now holds body
// metrics, strength and personal records, which is one subject rather than
// three tabs. Nothing was removed; the same components render in fewer places.
const TABS = ['profile', 'trainings', 'progress', 'packages', 'billing'];

const TAB_ICONS = {
  profile:   'user',
  trainings: 'dumbbell',
  progress:  'chart',
  packages:  'packages',
  billing:   'money',
};

const TYPE_COLORS = {
  Gym:        'bg-blue-100 text-blue-700',
  Cardio:     'bg-green-100 text-green-700',
  HIIT:       'bg-red-100 text-red-700',
  Bodyweight: 'bg-purple-100 text-purple-700',
  Custom:     'bg-yellow-100 text-yellow-700',
};

// Keyed rather than literal so the package type reads in the interface's
// language. These sat in English inside an otherwise Croatian screen.
const TYPE_LABEL_KEYS = {
  session_based: 'packages.typeSessionBased',
  time_based:    'packages.typeTimeBased',
  unlimited:     'packages.typeUnlimited',
};

const STATUS_STYLES = {
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  expired:   'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function ProgressSection({ clientId }) {
  const { t } = useTranslation();
  const [progressTab, setProgressTab] = useState('body');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button onClick={() => setProgressTab('body')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${progressTab === 'body' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          {t('progress.bodyMetrics')}
        </button>
        <button onClick={() => setProgressTab('strength')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${progressTab === 'strength' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          {t('progress.strength')}
        </button>
        <button onClick={() => setProgressTab('prs')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${progressTab === 'prs' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          {t('clients.tabs.prs')}
        </button>
      </div>
      {progressTab === 'body'     && <ProgressChart    clientId={clientId} />}
      {progressTab === 'strength' && <StrengthProgress clientId={clientId} />}
      {progressTab === 'prs'      && <PRSummary        clientId={clientId} />}
    </div>
  );
}

function PackagesSection({ clientId, clientName }) {
  const { t } = useTranslation();
  // Package dates followed the machine's locale, not the app's: bare
  // `toLocaleDateString()` is the same defect as `undefined` — see utils/locale.js.
  const dateLocale = useDateLocale();
  const [clientPackages, setClientPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  // "Cancel package" called showConfirm(), which is defined inside the
  // ClientDetail component further down this file — a different scope. Clicking
  // it threw "showConfirm is not defined" and the error boundary replaced the
  // whole client page. This section now owns its confirmation dialog.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(null);
  const [error, setError] = useState('');
  const token = () => localStorage.getItem('token');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/clients/${clientId}/packages`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setClientPackages(data.packages || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = (cp) => { setPendingCancel(cp); setConfirmOpen(true); };

  const doCancel = async () => {
    if (!pendingCancel) return;
    setError('');
    try {
      const res = await fetch(`${API_URL}/clients/${clientId}/packages/${pendingCancel.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (!res.ok) { setError(t('common.error')); return; }
      load();
    } catch { setError(t('common.error')); }
    finally { setPendingCancel(null); }
  };

  const active = clientPackages.filter(p => p.status === 'active');
  const history = clientPackages.filter(p => p.status !== 'active');

  const formatUsage = (cp) => {
    if (cp.package_type === 'session_based' && cp.total_sessions) {
      return `${cp.sessions_used} / ${cp.total_sessions} ${t('packages.sessionsUsed')} · ${cp.total_sessions - cp.sessions_used} ${t('packages.sessionsRemaining')}`;
    }
    if (cp.package_type === 'unlimited') return `${cp.sessions_used} ${t('packages.sessionsUsed')} · ${t('packages.unlimited')}`;
    if (cp.package_type === 'time_based') return cp.sessions_used > 0 ? `${cp.sessions_used} ${t('packages.sessionsUsed')}` : t('packages.noSessionsYet');
    return '';
  };

  const progressPct = (cp) => {
    if (cp.package_type !== 'session_based' || !cp.total_sessions) return null;
    return Math.min(100, Math.round((cp.sessions_used / cp.total_sessions) * 100));
  };

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center dark:text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-gray-300">{t('packages.activePackage')}</h3>
          <button onClick={() => setAssignOpen(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400">+ {t('packages.assignPackage')}</button>
        </div>

        {active.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center dark:border-gray-700">
            <p className="text-gray-400 text-sm mb-3 dark:text-gray-500">{t('packages.noActivePackage')}</p>
            <button onClick={() => setAssignOpen(true)} className="btn-primary text-sm">{t('packages.assignFirst')}</button>
          </div>
        ) : (
          active.map(cp => {
            const pct = progressPct(cp);
            return (
              <div key={cp.id} className="bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{cp.package_name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{t(TYPE_LABEL_KEYS[cp.package_type] || 'packages.typeSessionBased')}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full dark:text-emerald-300">{t('packages.status.active')}</span>
                </div>
                <p className="text-sm text-gray-600 mb-2 dark:text-gray-400">{formatUsage(cp)}</p>
                {pct !== null && (
                  <div className="mb-3">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">{pct}% {t('packages.used')}</p>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-gray-500 mb-3 dark:text-gray-400">
                  <span>{t('packages.started')}: {new Date(cp.start_date).toLocaleDateString(dateLocale)}</span>
                  {cp.end_date && <span>{t('packages.expires')}: {new Date(cp.end_date).toLocaleDateString(dateLocale)}</span>}
                </div>
                {cp.price && <p className="text-xs text-gray-400 mb-3 dark:text-gray-500">{Number(cp.price).toFixed(2)} {cp.currency}</p>}
                {cp.notes && <p className="text-xs text-gray-500 italic mb-3 dark:text-gray-400">"{cp.notes}"</p>}
                <button onClick={() => handleCancel(cp)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">{t('packages.cancelPackage')}</button>

                {/* Correcting the balance, and the ledger that explains it. */}
                <PackageAdjustPanel clientId={clientId} clientPackage={cp} onChanged={load} />
              </div>
            );
          })
        )}
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 dark:text-gray-300">{t('common.history')}</h3>
          <div className="space-y-2">
            {history.map(cp => (
              <div key={cp.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{cp.package_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">
                    {new Date(cp.start_date).toLocaleDateString(dateLocale)}
                    {cp.end_date ? ` → ${new Date(cp.end_date).toLocaleDateString(dateLocale)}` : ''}
                    {' · '}{cp.sessions_used} {t('packages.sessionsUsed')}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[cp.status] || 'bg-gray-100 text-gray-500'}`}>
                  {cp.status.charAt(0).toUpperCase() + cp.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm dark:bg-red-950/40">{error}</div>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => { setConfirmOpen(false); setPendingCancel(null); }}
        onConfirm={() => { setConfirmOpen(false); doCancel(); }}
        title={t('packages.cancelPackage')}
        message={t('packages.confirmCancel')}
        type="danger"
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
      />

      {assignOpen && (
        <AssignPackageModal
          clientName={clientName}
          onClose={() => setAssignOpen(false)}
          onAssigned={{ clientId, onSuccess: () => { setAssignOpen(false); load(); } }}
        />
      )}
    </div>
  );
}

export default function ClientDetail() {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const { id } = useParams();
  const navigate = useNavigate();

  const [client,       setClient]       = useState(null);
  const [trainings,    setTrainings]    = useState([]);
  const [tab,          setTab]          = useState('profile');
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editTraining, setEditTraining] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, type: 'warning' });
  const showConfirm = (title, message, onConfirm, type = 'warning') => setConfirmModal({ open: true, title, message, onConfirm, type });

  // Edit profile modal state
  const [editProfileOpen,   setEditProfileOpen]   = useState(false);
  const [editProfileForm,   setEditProfileForm]   = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [editProfileSaving, setEditProfileSaving] = useState(false);
  const [editProfileError,  setEditProfileError]  = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const hdr = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      // GROUP_SESSIONS_MERGED
      const [clientRes, trainingsRes, groupRes] = await Promise.all([
        fetch(`${API_URL}/clients/${id}`, { headers: hdr })
          .then(r => { if (!r.ok) throw new Error('Client not found'); return r.json(); }),
        trainingService.getAll({ clientId: id }),
        fetch(`${API_URL}/groups/sessions/for-client/${id}`, { headers: hdr })
          .then(r => r.json()).catch(() => ({ sessions: [] })),
      ]);
      setClient(clientRes.client || clientRes);
      const raw = trainingsRes.data;
      const individual = (
        Array.isArray(raw)             ? raw :
        Array.isArray(raw?.trainings)  ? raw.trainings :
        Array.isArray(raw?.sessions)   ? raw.sessions :
        Array.isArray(raw?.data)       ? raw.data : []
      ).map(t => ({ ...t, session_kind: 'individual' }));
      const groupSessions = (groupRes.sessions || []).map(gs => ({
        id:           gs.id,
        title:        gs.group_name,
        start_time:   gs.start_time,
        session_date: (gs.session_date || '').slice(0, 10),
        workout_type: gs.session_type || 'Group',
        is_completed: gs.is_completed,
        status:       gs.status,
        group_id:     gs.group_id,
        group_name:   gs.group_name,
        session_kind: 'group',
      }));
      const merged = [...individual, ...groupSessions].sort((a, b) => {
        const aK = `${a.session_date || ''}T${a.start_time || ''}`;
        const bK = `${b.session_date || ''}T${b.start_time || ''}`;
        return bK.localeCompare(aK);
      });
      setTrainings(merged);
    } catch (e) {
      setError(e.message || 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => { if (menuOpen) setMenuOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpen]);

  function onTrainingSaved(saved) {
    setTrainings(prev => {
      const idx = prev.findIndex(x => x.id === saved.id);
      return idx >= 0 ? prev.map((x, i) => i === idx ? saved : x) : [saved, ...prev];
    });
  }

  async function openEdit(trainingId) {
    try {
      const { data } = await trainingService.getById(trainingId);
      setEditTraining(data);
      setTrainingModalOpen(true);
    } catch { /* ignore */ }
  }

  async function saveProfile() {
    setEditProfileSaving(true);
    setEditProfileError('');
    try {
      const res = await fetch(`${API_URL}/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(editProfileForm),
      });
      const data = await res.json();
      if (data.success || data.client) {
        setClient(c => ({ ...c, ...data.client }));
        setEditProfileOpen(false);
      } else {
        // A rejected save used to leave the dialog sitting open with no
        // message, which reads as "nothing happened" rather than "that failed".
        setEditProfileError(data.message || data.error || t('common.error'));
      }
    } catch {
      setEditProfileError(t('common.error'));
    } finally {
      setEditProfileSaving(false);
    }
  }

  /**
   * Pause a client.
   *
   * The product had two ways to stop working with someone — "deactivate" and
   * "archive" — with different effects on the plan limit and the statistics,
   * and no explanation of the difference anywhere a trainer could read it.
   * There is one action now. It sets both columns, so a paused client is out of
   * the active list and out of the plan's client count, which is what a trainer
   * pausing someone means by it.
   */
  async function pauseClient() {
    setMenuOpen(false);
    showConfirm(
      t('clients.pause'),
      `${t('clients.pause')}: ${client.first_name} ${client.last_name}?`,
      async () => {
        await fetch(`${API_URL}/clients/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ isActive: false, isArchived: true }),
        });
        navigate('/dashboard/clients');
      }
    );
  }

  async function deleteClient() {
    setMenuOpen(false);
    showConfirm(
      t('common.delete'),
      t('clients.deleteConfirm'),
      async () => {
        await fetch(`${API_URL}/clients/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        navigate('/dashboard/clients');
      },
      'danger'
    );
  }

  async function reactivateClient() {
    setMenuOpen(false);
    await fetch(`${API_URL}/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ isArchived: false, isActive: true }),
    });
    load();
  }

  // One reading of "not currently training with me", however it was set.
  const isPaused = client ? (client.is_archived === true || client.is_active === false) : false;

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 dark:text-gray-500">{t('common.loading')}</div></div>;
  if (error) return (
    <div className="p-4 text-center">
      <p className="text-red-600 mb-4 dark:text-red-400">{error}</p>
      <button onClick={() => navigate('/dashboard/clients')} className="text-blue-600 hover:underline dark:text-blue-400">← {t('clients.title')}</button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8">
      <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm mt-4 mb-4 flex items-center gap-1 dark:text-gray-500">{t('common.back')}</button>

      {/* Client header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5">
        <div className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0">
          <span className="text-sky-700 dark:text-sky-300 font-bold text-xl">
            {client.first_name?.[0]}{client.last_name?.[0]}
          </span>
        </div>
        {/* min-w-0 / break-words / flex-shrink-0: a long client name or email
            address in a flex row with no shrink allowance widens the row past
            the viewport and the whole page scrolls sideways on a phone. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 break-words">
                {client.first_name} {client.last_name}
              </h1>
              {client.email && (
                <p className="text-gray-500 dark:text-gray-400 text-sm break-words">{client.email}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                {/* Two states, not three. "Deactivated" and "archived" were
                    different rows in the database and the same thing to a
                    trainer, with no explanation of the difference anywhere in
                    the product. Both now read as "paused"; which column is set
                    stays an implementation detail. */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  isPaused
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {isPaused ? t('clients.onPause') : t('clients.active')}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {t('counts.session', { count: Number(client.total_sessions) || 0 })}
                </span>
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={t('clients.actions')}
                  className="border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-gray-400"
                >
                  <Icon name="more" className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-10 overflow-hidden dark:border-gray-700"
                  >
                    <button role="menuitem" onClick={() => {
                      setEditProfileForm({ firstName: client.first_name, lastName: client.last_name, email: client.email || '', phone: client.phone || '' });
                      setEditProfileOpen(true);
                      setMenuOpen(false);
                    }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300">
                      {t('clients.editProfile')}
                    </button>

                    <button role="menuitem" onClick={() => { setEditTraining(null); setTrainingModalOpen(true); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300">
                      + {t('training.addTraining').replace('+ ', '')}
                    </button>

                    {!isPaused && (
                      <button role="menuitem" onClick={pauseClient}
                        className="w-full text-left px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40">
                        {t('clients.pause')}
                        <span className="block text-xs font-normal text-gray-400 dark:text-gray-500">{t('clients.pauseHint')}</span>
                      </button>
                    )}
                    {isPaused && (
                      <button role="menuitem" onClick={reactivateClient}
                        className="w-full text-left px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                        {t('clients.reactivate')}
                        <span className="block text-xs font-normal text-gray-400 dark:text-gray-500">{t('clients.reactivateHint')}</span>
                      </button>
                    )}

                    {/* Deleting a client used to be a red link in the list, one
                        tap from opening them. It belongs here, behind a
                        confirmation, on the page that shows what is about to
                        go: their sessions, packages and payments. */}
                    <button role="menuitem" onClick={deleteClient}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border-t border-gray-100 dark:border-gray-800">
                      {t('common.delete')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Everything the page is opened for, before any tab. */}
      <div className="mb-6">
        <ClientSummaryHeader
          client={client}
          onSchedule={isPaused ? null : () => setScheduleOpen(true)}
        />
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto dark:border-gray-700">
        {TABS.map(tabKey => (
          <button
            key={tabKey}
            role="tab"
            aria-selected={tab === tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-t ${
              tab === tabKey
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon name={TAB_ICONS[tabKey]} className="h-4 w-4" />
            {t(`clients.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="space-y-4">
          {[[t('clients.phone'), client.phone], [t('clients.dateOfBirth'), client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString(dateLocale) : null], [t('common.notes'), client.notes]]
            .map(([label, value]) => value ? (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-gray-800 dark:text-gray-200 text-sm">{value}</p>
              </div>
            ) : null)}
          {!client.phone && !client.date_of_birth && !client.notes && (
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-6">
              {t('clients.noAdditionalInfo')}{' '}
              <button onClick={() => {
                setEditProfileForm({ firstName: client.first_name, lastName: client.last_name, email: client.email || '', phone: client.phone || '' });
                setEditProfileOpen(true);
              }} className="text-sky-600 dark:text-sky-400 hover:underline">{t('clients.editProfile')}</button>
            </p>
          )}

          {/* Whether this client wants the day-before reminder. Recorded per
              client because it is their decision, and because an
              unsolicited-mail complaint asks exactly this. */}
          {client.email && (
            <label className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl px-4 py-3 cursor-pointer dark:bg-gray-800">
              <input
                type="checkbox"
                checked={client.reminders_opt_out !== true}
                onChange={async (e) => {
                  const optOut = !e.target.checked;
                  setClient(c => ({ ...c, reminders_opt_out: optOut }));
                  await fetch(`${API_URL}/clients/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ remindersOptOut: optOut }),
                  });
                }}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                  {t('profile.remindersOn')}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {t('clients.remindersOptOutHint')}
                </span>
              </span>
            </label>
          )}

          {/* Goals, injuries and diet notes used to be a tab of their own for
              what is three text fields about this person — which is what a
              profile is. */}
          <ClientNotesTab client={client} onUpdated={updated => setClient(c => ({ ...c, ...updated }))} />
        </div>
      )}

      {/* Trainings tab */}
      {tab === 'trainings' && (
        <div>
          {trainings.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl dark:border-gray-700">
              <p className="text-gray-400 text-sm mb-3 dark:text-gray-500">{t('training.noTrainings')}</p>
              {client.is_active && (
                <button onClick={() => { setEditTraining(null); setTrainingModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium">{t('training.addTraining')}</button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {trainings.map(tr => (
                <button
                  type="button"
                  key={tr.id}
                  onClick={() => tr.session_kind === 'group'
                    ? navigate(`/dashboard/groups/${tr.group_id}/sessions/${tr.id}?from=client&clientId=${id}`)
                    : openEdit(tr.id)}
                  className="w-full text-left flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:hover:bg-gray-800 dark:border-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-gray-800 dark:text-gray-200 truncate">{tr.title || tr.workout_type}</span>
                    <span className="block text-xs text-gray-400 mt-0.5 dark:text-gray-500">
                      {new Date(tr.session_kind === 'group' ? (tr.session_date + 'T' + (tr.start_time || '00:00')) : tr.start_time).toLocaleString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tr.workout_type] || 'bg-gray-100 text-gray-600'}`}>{tr.workout_type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tr.is_completed ? 'bg-green-100 text-green-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>{tr.is_completed ? t('training.completed') : t('sessions.scheduled')}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'progress'  && <ProgressSection clientId={id} />}
      {tab === 'packages'  && <PackagesSection clientId={id} clientName={`${client.first_name} ${client.last_name}`} />}
      {tab === 'billing' && <BillingTab clientId={id} />}
      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('clients.editProfile')}</h2>
              <button onClick={() => setEditProfileOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light dark:text-gray-500">×</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clients.firstName')} *</label>
                  <input type="text" value={editProfileForm.firstName} onChange={e => setEditProfileForm(f => ({ ...f, firstName: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clients.lastName')} *</label>
                  <input type="text" value={editProfileForm.lastName} onChange={e => setEditProfileForm(f => ({ ...f, lastName: e.target.value }))} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clients.email')}</label>
                <input type="email" value={editProfileForm.email} onChange={e => setEditProfileForm(f => ({ ...f, email: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clients.phone')}</label>
                <input type="tel" value={editProfileForm.phone} onChange={e => setEditProfileForm(f => ({ ...f, phone: e.target.value }))} className="input" />
              </div>
              {editProfileError && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm dark:bg-red-950/40">{editProfileError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setEditProfileOpen(false); setEditProfileError(''); }} className="flex-1 btn-secondary">{t('common.cancel')}</button>
                <button onClick={saveProfile} disabled={editProfileSaving} className="flex-1 btn-primary disabled:opacity-50">
                  {editProfileSaving ? t('common.saving') : t('clients.saveChanges')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal(m => ({ ...m, open: false }))}
        onConfirm={() => { confirmModal.onConfirm?.(); setConfirmModal(m => ({ ...m, open: false })); }}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
      />
      {/* Booking a session from here, with this client already selected.
          Getting to it used to mean going to the calendar and picking the
          client out of a dropdown of everyone — while standing in front of
          them. */}
      {scheduleOpen && (
        <SessionModal
          session={null}
          initialClientId={id}
          initialDate={null}
          initialTime={null}
          onClose={() => setScheduleOpen(false)}
          onSave={() => { setScheduleOpen(false); load(); }}
        />
      )}

      {/* Add Training Modal */}
      <AddTrainingModal
        isOpen={trainingModalOpen}
        onClose={() => { setTrainingModalOpen(false); setEditTraining(null); }}
        onSaved={saved => { onTrainingSaved(saved); setTrainingModalOpen(false); }}
        initialClientId={id}
        editTraining={editTraining}
      />
    </div>
  );
}
