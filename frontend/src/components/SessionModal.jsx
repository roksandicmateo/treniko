import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sessionsAPI, clientsAPI } from '../services/api';
import { format } from 'date-fns';
import TimeInput from './TimeInput';
import AdhocGroupPanel from './AdhocGroupPanel';
import Icon from './Icon';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from './training/AddTrainingModal';
import ConfirmModal from './ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const STATUS_CONFIG = {
  scheduled: { labelKey: 'sessions.legend_scheduled', color: 'bg-blue-100 text-blue-700' },
  completed:  { labelKey: 'sessions.legend_completed', color: 'bg-green-100 text-green-700' },
  cancelled:  { labelKey: 'sessions.legend_cancelled', color: 'bg-gray-100 text-gray-500' },
  no_show:    { labelKey: 'sessions.legend_noshow',   color: 'bg-red-100 text-red-600' },
};

// ── Package banner ────────────────────────────────────────────────────────────
const PackageBanner = ({ clientId, refreshKey }) => {
  const { t } = useTranslation();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);

  // `refreshKey` changes whenever this modal changes the session's status.
  // Completing a session now consumes a package session server-side, so the
  // balance shown here goes stale the moment the trainer taps "Completed" --
  // it kept reporting the pre-completion count until the modal was reopened.
  useEffect(() => {
    if (!clientId) { setPkg(null); setLoading(false); return; }
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/clients/${clientId}/packages`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        const active = (d.packages || []).find(p => p.status === 'active');
        setPkg(active || null);
      })
      .catch(() => setPkg(null))
      .finally(() => setLoading(false));
  }, [clientId, refreshKey]);

  if (loading || !pkg) return null;

  const sessionsLeft = pkg.total_sessions != null ? pkg.total_sessions - pkg.sessions_used : null;
  const daysLeft = pkg.end_date
    ? Math.ceil((new Date(pkg.end_date) - new Date()) / 86400000)
    : null;

  const isUrgent = (sessionsLeft !== null && sessionsLeft <= 2) || (daysLeft !== null && daysLeft <= 7);
  const isEmpty  = sessionsLeft !== null && sessionsLeft <= 0;

  const bgColor = isEmpty   ? 'bg-red-50 border-red-200' :
                  isUrgent  ? 'bg-amber-50 border-amber-200' :
                              'bg-blue-50 border-blue-200';
  const textColor = isEmpty  ? 'text-red-700' :
                    isUrgent ? 'text-amber-700' :
                               'text-blue-700';

  return (
    <div className={`mb-4 border rounded-xl px-4 py-3 ${bgColor}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="packages" className="h-5 w-5 flex-shrink-0" />
          <div className="min-w-0">
            <p className={`text-xs font-semibold truncate ${textColor}`}>{pkg.package_name}</p>
            <p className={`text-xs mt-0.5 ${textColor} opacity-80 `}>
              {pkg.package_type === 'session_based' && sessionsLeft !== null
                ? isEmpty
                  ? `⚠️ ${t('packages.noSessionsRemaining')}`
                  : `${sessionsLeft} ${t('packages.sessionsRemaining')}`
                : pkg.package_type === 'unlimited'
                  ? `${pkg.sessions_used} ${t('packages.sessionsUsed')} · ${t('packages.unlimited')}`
                  : `${pkg.sessions_used} ${t('packages.sessionsUsed')}`}
              {daysLeft !== null && (
                <span className="ml-2">
                  · {daysLeft <= 0 ? `⚠️ ${t('packages.expired')}` : `${daysLeft} ${t('packages.daysLeft')}`}
                </span>
              )}
            </p>
          </div>
        </div>
        {(isEmpty || isUrgent) && (
          <span className={`text-xs font-bold flex-shrink-0 ${isEmpty ? 'text-red-600' : 'text-amber-600'}`}>
            {isEmpty ? '❌' : '⚠️'}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Group Quick Select ───────────────────────────────────────────────────────
const GroupQuickSelect = ({ groups, selected, onSelect }) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const top2 = groups.slice(0, 2);
  const rest = groups.slice(2);

  const GroupChip = ({ g }) => (
    <button type="button" onClick={() => onSelect(g.id)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-colors ${
        selected === g.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}>
      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: g.color || '#0ea5e9' }}>
        {g.name?.[0]}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight dark:text-gray-200">{g.name}</p>
        <p className="text-xs text-gray-400 leading-tight dark:text-gray-500">{g.member_count} {t('groups.members')}</p>
      </div>
      {selected === g.id && <Icon name="check" className="h-4 w-4 text-blue-600 ml-1 flex-shrink-0 dark:text-blue-400" />}
    </button>
  );

  return (
    <div className="space-y-2">
      {/* Top 2 quick chips */}
      <div className="grid grid-cols-2 gap-2">
        {top2.map(g => <GroupChip key={g.id} g={g} />)}
      </div>

      {/* Expand to show all */}
      {rest.length > 0 && !showAll && (
        <button type="button" onClick={() => setShowAll(true)}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors dark:hover:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
          + {rest.length} {t('groups.title').toLowerCase()}
        </button>
      )}

      {showAll && (
        <div className="grid grid-cols-2 gap-2">
          {rest.map(g => <GroupChip key={g.id} g={g} />)}
        </div>
      )}
    </div>
  );
};

// ── Main modal ────────────────────────────────────────────────────────────────
/**
 * What the last status change did to the client's package.
 *
 * Marking a session complete either takes a session off a package or does not,
 * and until now the API answered identically either way — so a trainer whose
 * client had run out, or never had a package at all, saw a green tick and
 * carried on working for free. The outcome is now explicit, and where it is bad
 * news the notice carries the way to fix it.
 */
const PackageOutcomeNotice = ({ outcome, clientId, onAssign, t }) => {
  if (!outcome) return null;

  const kinds = {
    charged: {
      tone: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300',
      icon: 'check',
      text: t('sessions.chargedFromPackage', { package: outcome.packageName || '' }),
      action: false,
    },
    released: {
      tone: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900 text-sky-800 dark:text-sky-300',
      icon: 'refresh',
      text: t('sessions.sessionReleased'),
      action: false,
    },
    no_active_package: {
      tone: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300',
      icon: 'alert',
      text: t('sessions.noActivePackageWarning'),
      action: true,
    },
    package_exhausted: {
      tone: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300',
      icon: 'alert',
      text: t('sessions.packageExhaustedWarning'),
      action: true,
    },
    package_expired: {
      tone: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300',
      icon: 'alert',
      text: t('sessions.packageExpiredWarning'),
      action: true,
    },
  };

  const kind = kinds[outcome.outcome];
  if (!kind) return null;

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2.5 flex items-start gap-2 ${kind.tone}`} role="status">
      <Icon name={kind.icon} className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm">{kind.text}</p>
        {kind.action && clientId && (
          <button type="button" onClick={onAssign} className="mt-1 text-xs font-semibold underline">
            {t('sessions.assignPackageNow')}
          </button>
        )}
      </div>
    </div>
  );
};

const SessionModal = ({ session, initialDate, initialTime, initialEndTime, initialClientId, onClose, onSave }) => {
  const navigate = useNavigate();
  const [clients,         setClients]         = useState([]);
  const [groups,          setGroups]          = useState([]);
  const [sessionMode,     setSessionMode]     = useState('individual');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [linkedTraining,   setLinkedTraining]   = useState(null);
  const [showAddTraining,  setShowAddTraining]  = useState(false);
  const [loadingTraining,  setLoadingTraining]  = useState(false);
  const [formData, setFormData] = useState({
    clientId: '', sessionDate: '', startTime: '',
    endTime: '', sessionType: '', notes: '',
  });
  const { t } = useTranslation();
  const [loading,             setLoading]             = useState(false);
  const [statusLoading,       setStatusLoading]       = useState(false);
  const [error,               setError]               = useState('');
  const [conflicts,           setConflicts]           = useState([]);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adhocAttendees, setAdhocAttendees] = useState([]); // ad-hoc group attendees
  const [groupTitle, setGroupTitle]         = useState('');
  const [packageRefresh, setPackageRefresh] = useState(0);

  // What the last status change did to the client's package. The API always
  // answered 200 whether it charged a session or found no package at all, so
  // "one session taken off the block" and "this client has no package and you
  // just worked for free" looked identical on screen.
  const [packageOutcome, setPackageOutcome] = useState(null);

  // Whether a no-show costs the client a session is the trainer's policy, not
  // ours. The product must not decide it silently, so it asks — and remembers
  // the answer as the default for next time, because a trainer's policy is
  // usually the same every time.
  const [noShowAsk, setNoShowAsk] = useState(false);
  const [chargeNoShow, setChargeNoShow] = useState(
    () => localStorage.getItem('treniko_charge_no_show') === 'true'
  );

  useEffect(() => {
    loadClients();
    if (!session) loadGroups();
    if (session) {
      setFormData({
        clientId:    session.clientId    || '',
        isCompleted: session.isCompleted || false,
        sessionDate: session.sessionDate || '',
        startTime:   session.startTime   || '',
        endTime:     session.endTime     || '',
        sessionType: session.sessionType || '',
        notes:       session.notes       || '',
      });
      loadLinkedTraining(session.id);
    } else if (initialDate) {
      const time    = initialTime ? format(initialTime, 'HH:mm') : '09:00';
      const endHour = initialEndTime
        ? format(initialEndTime, 'HH:mm')
        : initialTime
          ? format(new Date(initialTime.getTime() + 60 * 60 * 1000), 'HH:mm')
          : '10:00';
      setFormData({ clientId: initialClientId || '', sessionDate: initialDate, startTime: time, endTime: endHour, sessionType: '', notes: '' });
    }
  }, [session, initialDate, initialTime, initialEndTime, initialClientId]);

  const loadLinkedTraining = async (sessionId) => {
    setLoadingTraining(true);
    try {
      const { data } = await trainingService.getBySession(sessionId);
      setLinkedTraining(data);
    } catch { setLinkedTraining(null); }
    finally { setLoadingTraining(false); }
  };

  const loadClients = async () => {
    try {
      const response = await clientsAPI.getAll({ isActive: 'true' });
      setClients(response.data.clients);
    } catch (err) { console.error('Failed to load clients:', err); }
  };

  const loadGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/groups`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setGroups(data.groups || []);
    } catch { /* ignore */ }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setShowConflictWarning(false);
  };

  const handleSetStatus = async (newStatus, options = {}) => {
    if (!session) return;

    // A no-show asks first, unless this call is the answer to that question.
    if (newStatus === 'no_show' && !options.answered) {
      setNoShowAsk(true);
      return;
    }

    setStatusLoading(true);
    setError('');
    setPackageOutcome(null);
    try {
      const payload = { status: newStatus };
      if (newStatus === 'no_show') {
        payload.chargeNoShow = options.chargeNoShow === true;
        localStorage.setItem('treniko_charge_no_show', String(options.chargeNoShow === true));
        setChargeNoShow(options.chargeNoShow === true);
      }

      const res = await sessionsAPI.update(session.id, payload);
      if (linkedTraining) await trainingService.update(linkedTraining.id, { isCompleted: newStatus === 'completed' });

      // Shown here rather than swallowed: the outcome is the difference
      // between a session that was paid for and one that was not.
      if (res?.data?.packageOutcome) {
        setPackageOutcome({
          outcome: res.data.packageOutcome,
          packageName: res.data.clientPackage?.package_name,
        });
      }
      setNoShowAsk(false);
      setPackageRefresh(n => n + 1);
      onSave();
    } catch (err) { setError(err.response?.data?.message || t('common.error')); }
    finally { setStatusLoading(false); }
  };

  const saveSession = async (force = false) => {
    setLoading(true);
    setError('');
    try {
      // Ad-hoc group session
      if (!session && sessionMode === 'adhoc-group') {
        if (adhocAttendees.length === 0) { setError(t('sessions.atLeastOneAttendee')); setLoading(false); return; }
        const payload = { ...formData, isGroup: true, groupTitle: groupTitle || null, attendees: adhocAttendees };
        await sessionsAPI.create(payload);
        setShowConflictWarning(false);
        onSave();
        return;
      }
      // Group session — call group endpoint
      if (!session && sessionMode === 'group') {
        if (!selectedGroupId) { setError(t('sessions.selectGroup')); setLoading(false); return; }
        const res = await fetch(`${API_URL}/groups/${selectedGroupId}/sessions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to schedule'); setLoading(false); return; }
        onSave();
        return;
      }
      // Individual session
      const payload = { ...formData, ...(force ? { force: true } : {}) };
      if (session) { await sessionsAPI.update(session.id, payload); }
      else         { await sessionsAPI.create(payload); }
      setShowConflictWarning(false);
      setConflicts([]);
      onSave();
    } catch (err) {
      const data = err.response?.data;
      if (data?.error === 'conflict') {
        setConflicts(data.conflicts || []);
        setShowConflictWarning(true);
      } else {
        setError(data?.message || 'Failed to save session');
      }
    } finally { setLoading(false); }
  };

  const handleSubmit     = async (e) => { e.preventDefault(); await saveSession(false); };
  const handleForceSubmit = async () => { await saveSession(true); };

  const handleDelete = () => setConfirmDelete(true);
  const doDelete = async () => {
    setConfirmDelete(false);
    setLoading(true);
    try { await sessionsAPI.delete(session.id); onSave(); }
    catch { setError('Failed to delete session'); setLoading(false); }
  };

  const currentStatus = session?.status || (session?.isCompleted ? 'completed' : 'scheduled');
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.scheduled;
  const activeClientId = session ? session.clientId : formData.clientId;

  const sessionStartISO = session ? `${session.sessionDate}T${session.startTime}` : null;
  const sessionEndISO   = session ? `${session.sessionDate}T${session.endTime}`   : null;

  const sessionTypes = t('sessions.sessionTypes', { returnObjects: true });

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-800">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {session ? t('sessions.editSession') : t('sessions.newSession')}
            </h2>
            {session && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.color}`}>
                {t(statusCfg.labelKey)}
              </span>
            )}
          </div>

          {/* Package banner — shows for both new and existing sessions once client is known */}
          {activeClientId && <PackageBanner clientId={activeClientId} refreshKey={packageRefresh} />}

          {/* Conflict warning */}
          {showConflictWarning && conflicts.length > 0 && (
            <div className="mb-5 bg-amber-50 border border-amber-300 rounded-xl p-4 dark:bg-amber-950/40">
              <div className="flex items-start gap-2 mb-3">
                <Icon name="alert" className="h-6 w-6 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">{t('sessions.conflictDetected')}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{t('sessions.conflictOverlaps')}</p>
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                {conflicts.map(c => (
                  <div key={c.id} className="bg-white rounded-lg px-3 py-2 border border-amber-200 dark:bg-gray-900">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.clientName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {c.startTime?.slice(0, 5)} – {c.endTime?.slice(0, 5)}
                      {c.sessionType ? ` · ${c.sessionType}` : ''}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowConflictWarning(false); setConflicts([]); }}
                  className="flex-1 py-2 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                  {t('common.cancel')}
                </button>
                <button onClick={handleForceSubmit} disabled={loading}
                  className="flex-1 py-2 text-xs rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50">
                  {t('sessions.scheduleAnyway')}
                </button>
              </div>
            </div>
          )}

          {/* Status buttons + training for existing sessions */}
          {session && (
            <div className="mb-5">
              {loadingTraining ? (
                <div className="text-xs text-gray-400 mb-3 dark:text-gray-500">{t('common.loading')}</div>
              ) : linkedTraining ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3 dark:bg-emerald-950/40">
                  <div>
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-0.5 dark:text-emerald-400">{t('sessions.trainingLogged')}</p>
                    <p className="text-sm font-semibold text-green-800">{linkedTraining.title || linkedTraining.workout_type}</p>
                    {linkedTraining.exercises?.length > 0 && (
                      <p className="text-xs text-green-600 dark:text-emerald-400">{linkedTraining.exercises.length} {t('training.exercises')}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowAddTraining(true)}
                    className="ml-3 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                    {t('common.view')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-3 dark:bg-gray-800 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('sessions.noTrainingLogged')}</p>
                  <button type="button" onClick={() => setShowAddTraining(true)}
                    className="ml-3 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                    {t('sessions.addTraining')}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {[
                  { status: 'completed', icon: 'check',    label: t('sessions.completed'),
                    active: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300',
                    inactive: 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' },
                  { status: 'no_show',   icon: 'x',        label: t('sessions.noShow'),
                    active: 'bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300',
                    inactive: 'border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40' },
                  { status: 'cancelled', icon: 'trash',    label: t('sessions.cancelled'),
                    active: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300',
                    inactive: 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800' },
                  { status: 'scheduled', icon: 'calendar', label: t('sessions.scheduled'),
                    active: 'bg-sky-100 dark:bg-sky-950/50 border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300',
                    inactive: 'border-sky-300 dark:border-sky-900 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40' },
                ].map(({ status, icon, label, active, inactive }) => (
                  <button key={status} type="button"
                    onClick={() => handleSetStatus(status)}
                    disabled={statusLoading || currentStatus === status}
                    className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${currentStatus === status ? `${active} cursor-default` : inactive}`}>
                    <Icon name={icon} className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* The no-show question. Asked, not assumed. */}
              {noShowAsk && (
                <div className="mt-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    {t('sessions.noShowChargeQuestion')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={statusLoading}
                      onClick={() => handleSetStatus('no_show', { answered: true, chargeNoShow: true })}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                    >
                      {t('sessions.noShowChargeYes')}
                    </button>
                    <button
                      type="button"
                      disabled={statusLoading}
                      onClick={() => handleSetStatus('no_show', { answered: true, chargeNoShow: false })}
                      className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                    >
                      {t('sessions.noShowChargeNo')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoShowAsk(false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {/* What that did to the package. */}
              {packageOutcome && (
                <PackageOutcomeNotice
                  outcome={packageOutcome}
                  clientId={activeClientId}
                  onAssign={() => { setPackageOutcome(null); onClose(); navigate(`/dashboard/clients/${activeClientId}`); }}
                  t={t}
                />
              )}
            </div>
          )}

          {/* Ad-hoc group attendance panel */}
          {session?.isGroup && (
            <AdhocGroupPanel sessionId={session.id} />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Individual / Group / Ad-hoc toggle — only for new sessions */}
            {!session && (
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                <button type="button" onClick={() => { setSessionMode('individual'); setSelectedGroupId(''); setAdhocAttendees([]); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${sessionMode === 'individual' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  👤 {t('sessions.individual')}
                </button>
                <button type="button" onClick={() => { setSessionMode('adhoc-group'); setSelectedGroupId(''); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${sessionMode === 'adhoc-group' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  👥 {t('sessions.adhocGroup')}
                </button>
                <button type="button" onClick={() => { setSessionMode('group'); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${sessionMode === 'group' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  🏟 {t('nav.groups')}
                </button>
              </div>
            )}

            {/* Individual: client selector */}
            {(!session && sessionMode === 'individual') || session ? (
              <div>
                <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.client')} *</label>
                <select id="clientId" name="clientId" value={formData.clientId} onChange={handleChange} required className="input">
                  <option value="">{t('sessions.selectClient')}</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.first_name} {client.last_name}</option>
                  ))}
                </select>
                {session && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{t('sessions.client')}: {session.clientName}</p>}
              </div>
            ) : null}

            {/* Ad-hoc group: title + multi-select clients */}
            {!session && sessionMode === 'adhoc-group' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.groupName')} <span className="text-gray-400 text-xs dark:text-gray-500">({t('sessions.optional')})</span></label>
                  <input type="text" className="input" placeholder={t('sessions.groupNamePlaceholder')}
                    value={groupTitle} onChange={e => setGroupTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.participants')}</label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl max-h-40 overflow-y-auto">
                    {clients.length === 0 ? (
                      <p className="text-sm text-gray-400 p-3 dark:text-gray-500">{t('sessions.noClients')}</p>
                    ) : clients.map(cl => {
                      const checked = adhocAttendees.includes(cl.id);
                      return (
                        <label key={cl.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <input type="checkbox" checked={checked}
                            onChange={() => setAdhocAttendees(prev => checked ? prev.filter(id => id !== cl.id) : [...prev, cl.id])}
                            className="rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{cl.first_name} {cl.last_name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {adhocAttendees.length > 0 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">{adhocAttendees.length} {t('sessions.participantsSelected')}</p>
                  )}
                </div>
              </div>
            )}

            {/* Group: group selector — top 2 + expand */}
            {!session && sessionMode === 'group' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('nav.groups')} *</label>
                {groups.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                    {t('groups.noGroups')}. <Link to="/dashboard/groups" className="text-blue-600 hover:underline dark:text-blue-400">{t('groups.addFirst')} →</Link>
                  </div>
                ) : (
                  <GroupQuickSelect
                    groups={groups}
                    selected={selectedGroupId}
                    onSelect={setSelectedGroupId}
                  />
                )}
                {selectedGroupId && (
                  <p className="text-xs text-blue-600 mt-1.5 dark:text-blue-400">
                    ℹ️ {t('sessions.sessionFor')} {groups.find(g => g.id === selectedGroupId)?.member_count || 0} {t('sessions.members')}
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="sessionDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.date')} *</label>
              <input type="date" id="sessionDate" name="sessionDate" value={formData.sessionDate} onChange={handleChange} required className="input" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.startTime')} *</label>
                <TimeInput id="startTime" value={formData.startTime} onChange={v => handleChange({ target: { name: "startTime", value: v } })} required />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.endTime')} *</label>
                <TimeInput id="endTime" value={formData.endTime} onChange={v => handleChange({ target: { name: "endTime", value: v } })} required />
              </div>
            </div>

            <div>
              <label htmlFor="sessionType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.sessionType')}</label>
              <select id="sessionType" name="sessionType" value={formData.sessionType} onChange={handleChange} className="input">
                <option value="">{t('sessions.selectType')}</option>
                {sessionTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.notes')}</label>
              <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={3} className="input" placeholder={t('sessions.notesPlaceholder')} />
            </div>

            {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm dark:bg-red-950/40 dark:text-red-400">{error}</div>}

            <div className="flex space-x-3 pt-2">
              {session && <button type="button" onClick={handleDelete} className="btn-danger" disabled={loading}>{t('common.delete')}</button>}
              <button type="button" onClick={onClose} className="flex-1 btn-secondary" disabled={loading}>{t('common.cancel')}</button>
              <button type="submit" className="flex-1 btn-primary" disabled={loading}>
                {loading ? t('common.saving') :
                  (!session && sessionMode === 'group' && selectedGroupId)
                    ? `${t('sessions.sessionFor')} ${groups.find(g => g.id === selectedGroupId)?.member_count || 0} ${t('sessions.members')}`
                    : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title={t('sessions.deleteSession')}
        message={t('sessions.deleteConfirm')}
        type="danger"
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
      />
      {showAddTraining && session && (
        <AddTrainingModal
          isOpen={showAddTraining}
          onClose={() => setShowAddTraining(false)}
          onSaved={t => { setLinkedTraining(t); setShowAddTraining(false); }}
          initialClientId={session.clientId}
          initialStartTime={sessionStartISO}
          editTraining={linkedTraining}
          sessionId={session.id}
          overrideEndTime={sessionEndISO}
        />
      )}
    </>
  );
};

export default SessionModal;
