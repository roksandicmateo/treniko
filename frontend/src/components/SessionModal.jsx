import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { sessionsAPI, clientsAPI } from '../services/api';
import { format } from 'date-fns';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from './training/AddTrainingModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const STATUS_CONFIG = {
  scheduled: { labelKey: 'sessions.legend_scheduled', color: 'bg-blue-100 text-blue-700' },
  completed:  { labelKey: 'sessions.legend_completed', color: 'bg-green-100 text-green-700' },
  cancelled:  { labelKey: 'sessions.legend_cancelled', color: 'bg-gray-100 text-gray-500' },
  no_show:    { labelKey: 'sessions.legend_noshow',   color: 'bg-red-100 text-red-600' },
};

// ── Package banner ────────────────────────────────────────────────────────────
const PackageBanner = ({ clientId }) => {
  const { t } = useTranslation();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);

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
  }, [clientId]);

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
          <span className="text-base flex-shrink-0">📦</span>
          <div className="min-w-0">
            <p className={`text-xs font-semibold truncate ${textColor}`}>{pkg.package_name}</p>
            <p className={`text-xs mt-0.5 ${textColor} opacity-80`}>
              {pkg.package_type === 'session_based' && sessionsLeft !== null
                ? isEmpty
                  ? '⚠️ No sessions remaining'
                  : `${sessionsLeft} session${sessionsLeft !== 1 ? 's' : ''} remaining`
                : pkg.package_type === 'unlimited'
                  ? `${pkg.sessions_used} sessions used · Unlimited`
                  : `${pkg.sessions_used} sessions used`}
              {daysLeft !== null && (
                <span className="ml-2">
                  · {daysLeft <= 0 ? '⚠️ Expired' : `${daysLeft}d until expiry`}
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
        <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{g.name}</p>
        <p className="text-xs text-gray-400 leading-tight">{g.member_count} member{g.member_count !== 1 ? 's' : ''}</p>
      </div>
      {selected === g.id && <span className="text-blue-600 text-sm ml-1 flex-shrink-0">✓</span>}
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
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
          + {rest.length} more group{rest.length !== 1 ? 's' : ''}
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
const SessionModal = ({ session, initialDate, initialTime, initialEndTime, initialClientId, onClose, onSave }) => {
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

  const handleSetStatus = async (newStatus) => {
    if (!session) return;
    setStatusLoading(true);
    try {
      await sessionsAPI.update(session.id, { status: newStatus });
      if (linkedTraining) await trainingService.update(linkedTraining.id, { isCompleted: newStatus === 'completed' });
      onSave();
    } catch { setError('Failed to update session status'); }
    finally { setStatusLoading(false); }
  };

  const saveSession = async (force = false) => {
    setLoading(true);
    setError('');
    try {
      // Group session — call group endpoint
      if (!session && sessionMode === 'group') {
        if (!selectedGroupId) { setError('Please select a group'); setLoading(false); return; }
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    setLoading(true);
    try { await sessionsAPI.delete(session.id); onSave(); }
    catch { setError('Failed to delete session'); setLoading(false); }
  };

  const currentStatus = session?.status || (session?.isCompleted ? 'completed' : 'scheduled');
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.scheduled;
  const activeClientId = session ? session.clientId : formData.clientId;

  const sessionStartISO = session ? `${session.sessionDate}T${session.startTime}` : null;
  const sessionEndISO   = session ? `${session.sessionDate}T${session.endTime}`   : null;

  const sessionTypes = ['Strength Training', 'Cardio', 'HIIT', 'Yoga', 'Pilates', 'Boxing', 'Consultation', 'Other'];

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
          {activeClientId && <PackageBanner clientId={activeClientId} />}

          {/* Conflict warning */}
          {showConflictWarning && conflicts.length > 0 && (
            <div className="mb-5 bg-amber-50 border border-amber-300 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-xl flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">{t('sessions.conflictDetected')}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{t('sessions.conflictOverlaps')}</p>
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                {conflicts.map(c => (
                  <div key={c.id} className="bg-white rounded-lg px-3 py-2 border border-amber-200">
                    <p className="text-sm font-medium text-gray-800">{c.clientName}</p>
                    <p className="text-xs text-gray-500">
                      {c.startTime?.slice(0, 5)} – {c.endTime?.slice(0, 5)}
                      {c.sessionType ? ` · ${c.sessionType}` : ''}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowConflictWarning(false); setConflicts([]); }}
                  className="flex-1 py-2 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
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
                <div className="text-xs text-gray-400 mb-3">{t('common.loading')}</div>
              ) : linkedTraining ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
                  <div>
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-0.5">{t('sessions.trainingLogged')}</p>
                    <p className="text-sm font-semibold text-green-800">{linkedTraining.title || linkedTraining.workout_type}</p>
                    {linkedTraining.exercises?.length > 0 && (
                      <p className="text-xs text-green-600">{linkedTraining.exercises.length} exercise{linkedTraining.exercises.length !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowAddTraining(true)}
                    className="ml-3 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                    View →
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-3">
                  <p className="text-sm text-gray-500">{t('sessions.noTrainingLogged')}</p>
                  <button type="button" onClick={() => setShowAddTraining(true)}
                    className="ml-3 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                    {t('sessions.addTraining')}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {[
                  { status: 'completed', label: `✅ ${t('sessions.completed')}`, active: 'bg-green-100 border-green-300 text-green-700', inactive: 'border-green-300 text-green-600 hover:bg-green-50' },
                  { status: 'no_show',  label: `❌ ${t('sessions.noShow')}`,   active: 'bg-red-100 border-red-300 text-red-700',     inactive: 'border-red-300 text-red-500 hover:bg-red-50' },
                  { status: 'cancelled',label: `🚫 ${t('sessions.cancelled')}`, active: 'bg-gray-100 border-gray-300 text-gray-600', inactive: 'border-gray-300 text-gray-500 hover:bg-gray-50' },
                  { status: 'scheduled',label: `📅 ${t('sessions.scheduled')}`, active: 'bg-blue-100 border-blue-300 text-blue-700', inactive: 'border-blue-300 text-blue-500 hover:bg-blue-50' },
                ].map(({ status, label, active, inactive }) => (
                  <button key={status} type="button"
                    onClick={() => handleSetStatus(status)}
                    disabled={statusLoading || currentStatus === status}
                    className={`py-2 px-3 rounded-xl text-sm font-medium border transition-colors ${currentStatus === status ? `${active} cursor-default` : inactive}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Individual / Group toggle — only for new sessions */}
            {!session && (
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                <button type="button" onClick={() => { setSessionMode('individual'); setSelectedGroupId(''); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${sessionMode === 'individual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {`👤 ${t('sessions.individual')}`}
                </button>
                <button type="button" onClick={() => { setSessionMode('group'); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${sessionMode === 'group' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {`👥 ${t('sessions.group')}`}
                </button>
              </div>
            )}

            {/* Individual: client selector */}
            {(!session && sessionMode === 'individual') || session ? (
              <div>
                <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.client')} *</label>
                <select id="clientId" name="clientId" value={formData.clientId} onChange={handleChange} required className="input" disabled={session !== null}>
                  <option value="">{t('sessions.selectClient')}</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.first_name} {client.last_name}</option>
                  ))}
                </select>
                {session && <p className="text-xs text-gray-500 mt-1">{t('sessions.client')}: {session.clientName}</p>}
              </div>
            ) : null}

            {/* Group: group selector — top 2 + expand */}
            {!session && sessionMode === 'group' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('nav.groups')} *</label>
                {groups.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500">
                    {t('groups.noGroups')}. <a href="/dashboard/groups" className="text-blue-600 hover:underline">{t('groups.addFirst')} →</a>
                  </div>
                ) : (
                  <GroupQuickSelect
                    groups={groups}
                    selected={selectedGroupId}
                    onSelect={setSelectedGroupId}
                  />
                )}
                {selectedGroupId && (
                  <p className="text-xs text-blue-600 mt-1.5">
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
                <input type="time" id="startTime" name="startTime" value={formData.startTime} onChange={handleChange} required className="input" />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.endTime')} *</label>
                <input type="time" id="endTime" name="endTime" value={formData.endTime} onChange={handleChange} required className="input" />
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

            {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

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
