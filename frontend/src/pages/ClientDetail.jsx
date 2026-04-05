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
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TABS = ['profile', 'trainings', 'progress', 'packages', 'notes', 'prs', 'billing'];

const TYPE_COLORS = {
  Gym:        'bg-blue-100 text-blue-700',
  Cardio:     'bg-green-100 text-green-700',
  HIIT:       'bg-red-100 text-red-700',
  Bodyweight: 'bg-purple-100 text-purple-700',
  Custom:     'bg-yellow-100 text-yellow-700',
};

const TYPE_LABELS = {
  session_based: '🎯 Session-based',
  time_based: '📅 Time-based',
  unlimited: '♾️ Unlimited',
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
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setProgressTab('body')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${progressTab === 'body' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('progress.bodyMetrics')}
        </button>
        <button onClick={() => setProgressTab('strength')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${progressTab === 'strength' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('progress.strength')}
        </button>
      </div>
      {progressTab === 'body'     && <ProgressChart    clientId={clientId} />}
      {progressTab === 'strength' && <StrengthProgress clientId={clientId} />}
    </div>
  );
}

function PackagesSection({ clientId, clientName }) {
  const { t } = useTranslation();
  const [clientPackages, setClientPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
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

  const handleCancel = async (cp) => {
    showConfirm(t('packages.cancelPackage'), t('packages.confirmCancel'), async () => {
      await fetch(`${API_URL}/clients/${clientId}/packages/${cp.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      load();
    });
  };

  const active = clientPackages.filter(p => p.status === 'active');
  const history = clientPackages.filter(p => p.status !== 'active');

  const formatUsage = (cp) => {
    if (cp.package_type === 'session_based' && cp.total_sessions) {
      return `${cp.sessions_used} / ${cp.total_sessions} sessions used · ${cp.total_sessions - cp.sessions_used} remaining`;
    }
    if (cp.package_type === 'unlimited') return `${cp.sessions_used} sessions used · Unlimited`;
    if (cp.package_type === 'time_based') return cp.sessions_used > 0 ? `${cp.sessions_used} sessions used` : 'No sessions yet';
    return '';
  };

  const progressPct = (cp) => {
    if (cp.package_type !== 'session_based' || !cp.total_sessions) return null;
    return Math.min(100, Math.round((cp.sessions_used / cp.total_sessions) * 100));
  };

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('packages.activePackage')}</h3>
          <button onClick={() => setAssignOpen(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ {t('packages.assignPackage')}</button>
        </div>

        {active.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-gray-400 text-sm mb-3">{t('packages.noActivePackage')}</p>
            <button onClick={() => setAssignOpen(true)} className="btn-primary text-sm">{t('packages.assignFirst')}</button>
          </div>
        ) : (
          active.map(cp => {
            const pct = progressPct(cp);
            return (
              <div key={cp.id} className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{cp.package_name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[cp.package_type]}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">{t('packages.status.active')}</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{formatUsage(cp)}</p>
                {pct !== null && (
                  <div className="mb-3">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{pct}% used</p>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-gray-500 mb-3">
                  <span>Started: {new Date(cp.start_date).toLocaleDateString('en-GB')}</span>
                  {cp.end_date && <span>Expires: {new Date(cp.end_date).toLocaleDateString('en-GB')}</span>}
                </div>
                {cp.price && <p className="text-xs text-gray-400 mb-3">{Number(cp.price).toFixed(2)} {cp.currency}</p>}
                {cp.notes && <p className="text-xs text-gray-500 italic mb-3">"{cp.notes}"</p>}
                <button onClick={() => handleCancel(cp)} className="text-xs text-red-500 hover:text-red-700">{t('packages.cancelPackage')}</button>
              </div>
            );
          })
        )}
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{t('common.history')}</h3>
          <div className="space-y-2">
            {history.map(cp => (
              <div key={cp.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">{cp.package_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(cp.start_date).toLocaleDateString('en-GB')}
                    {cp.end_date ? ` → ${new Date(cp.end_date).toLocaleDateString('en-GB')}` : ''}
                    {' · '}{cp.sessions_used} session{cp.sessions_used !== 1 ? 's' : ''} used
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
  const { id } = useParams();
  const navigate = useNavigate();

  const [client,       setClient]       = useState(null);
  const [trainings,    setTrainings]    = useState([]);
  const [tab,          setTab]          = useState('profile');
  const [modalOpen,    setModalOpen]    = useState(false);
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [clientRes, trainingsRes] = await Promise.all([
        fetch(`/api/clients/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
          .then(r => { if (!r.ok) throw new Error('Client not found'); return r.json(); }),
        trainingService.getAll({ clientId: id }),
      ]);
      setClient(clientRes.client || clientRes);
      setTrainings(trainingsRes.data);
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
      setModalOpen(true);
    } catch { /* ignore */ }
  }

  async function saveProfile() {
    setEditProfileSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(editProfileForm),
      });
      const data = await res.json();
      if (data.success || data.client) {
        setClient(c => ({ ...c, ...data.client }));
        setEditProfileOpen(false);
      }
    } finally {
      setEditProfileSaving(false);
    }
  }

  async function deactivateClient() {
    showConfirm(t('clients.deactivate'), `${t('clients.deactivate')} ${client.first_name} ${client.last_name}?`, async () => {
      await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ isActive: false }),
      });
      navigate('/dashboard/clients');
    });
  }

  async function archiveClient() {
    showConfirm(t('clients.archive'), `${t('clients.archive')} ${client.first_name} ${client.last_name}?`, async () => {
      await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ isArchived: true, isActive: false }),
      });
      navigate('/dashboard/clients');
    });
  }

  async function reactivateClient() {
    await fetch(`/api/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ isArchived: false, isActive: true }),
    });
    load();
  }

  const upcoming = trainings.filter(tr => !tr.is_completed && new Date(tr.start_time) >= new Date());

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">{t('common.loading')}</div></div>;
  if (error) return (
    <div className="p-4 text-center">
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={() => navigate('/dashboard/clients')} className="text-blue-600 hover:underline">← Back to clients</button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8">
      <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm mt-4 mb-4 flex items-center gap-1">{t('common.back')}</button>

      {/* Client header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-600 font-bold text-2xl">{client.first_name?.[0]}{client.last_name?.[0]}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{client.first_name} {client.last_name}</h1>
              {client.email && <p className="text-gray-500 dark:text-gray-400 text-sm">{client.email}</p>}
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  client.is_archived ? 'bg-yellow-100 text-yellow-700' :
                  client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {client.is_archived ? 'Archived' : client.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-gray-300 text-xs">{trainings.length} training{trainings.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {client.is_active && !client.is_archived && (
                <button onClick={() => { setEditTraining(null); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                  + Training
                </button>
              )}
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-xl text-sm">···</button>
                {menuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                    <button onClick={() => {
                      setEditProfileForm({ firstName: client.first_name, lastName: client.last_name, email: client.email || '', phone: client.phone || '' });
                      setEditProfileOpen(true);
                      setMenuOpen(false);
                    }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-xl">{t('clients.editProfile')}</button>
                    {client.is_active && client.is_archived !== true && (
                      <button onClick={deactivateClient} className="w-full text-left px-4 py-2.5 text-sm text-yellow-600 hover:bg-yellow-50">{t('clients.deactivate')}</button>
                    )}
                    {client.is_archived !== true && (
                      <button onClick={archiveClient} className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">{t('clients.archive')}</button>
                    )}
                    {!client.is_active && client.is_archived !== true && (
                      <button onClick={reactivateClient} className="w-full text-left px-4 py-2.5 text-sm text-green-600 hover:bg-green-50">{t('clients.reactivate')}</button>
                    )}
                    {client.is_archived === true && (
                      <button onClick={reactivateClient} className="w-full text-left px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 rounded-b-xl">{t('clients.reactivate')}</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{trainings.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('clients.stats.total')}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{trainings.filter(tr => tr.is_completed).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('clients.stats.completed')}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{upcoming.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('clients.stats.upcoming')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === tabKey ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
{tabKey === 'packages' ? `📦 ${t('clients.tabs.packages')}` : tabKey === 'notes' ? `📋 ${t('clients.tabs.notes')}` : tabKey === 'prs' ? `🏆 ${t('clients.tabs.prs')}` : tabKey === 'billing' ? `💳 ${t('clients.tabs.billing')}` : t(`clients.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="space-y-4">
          {[['Phone', client.phone], ['Date of Birth', client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString() : null], ['Notes', client.notes]]
            .map(([label, value]) => value ? (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-gray-800 dark:text-gray-200 text-sm">{value}</p>
              </div>
            ) : null)}
          {!client.phone && !client.date_of_birth && !client.notes && (
            <p className="text-gray-400 text-sm text-center py-8">
              {t('clients.noAdditionalInfo')}{' '}
              <button onClick={() => {
                setEditProfileForm({ firstName: client.first_name, lastName: client.last_name, email: client.email || '', phone: client.phone || '' });
                setEditProfileOpen(true);
              }} className="text-blue-600 hover:underline">{t('clients.editProfile')}</button>
            </p>
          )}
        </div>
      )}

      {/* Trainings tab */}
      {tab === 'trainings' && (
        <div>
          {trainings.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-400 text-sm mb-3">{t('training.noTrainings')}</p>
              {client.is_active && (
                <button onClick={() => { setEditTraining(null); setModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium">{t('training.addTraining')}</button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {trainings.map(tr => (
                <div key={tr.id} onClick={() => openEdit(tr.id)} className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{tr.title || tr.workout_type}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tr.start_time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tr.workout_type] || 'bg-gray-100 text-gray-600'}`}>{tr.workout_type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tr.is_completed ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{tr.is_completed ? t('trainings.completed') : t('trainings.scheduled')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'progress'  && <ProgressSection clientId={id} />}
      {tab === 'packages'  && <PackagesSection clientId={id} clientName={`${client.first_name} ${client.last_name}`} />}
      {tab === 'notes'     && <ClientNotesTab client={client} onUpdated={updated => setClient(c => ({ ...c, ...updated }))} />}
      {tab === 'prs'       && <PRSummary clientId={id} />}
      {tab === 'billing' && <BillingTab clientId={id} />}
      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
              <button onClick={() => setEditProfileOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">×</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                  <input type="text" value={editProfileForm.firstName} onChange={e => setEditProfileForm(f => ({ ...f, firstName: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                  <input type="text" value={editProfileForm.lastName} onChange={e => setEditProfileForm(f => ({ ...f, lastName: e.target.value }))} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input type="email" value={editProfileForm.email} onChange={e => setEditProfileForm(f => ({ ...f, email: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input type="tel" value={editProfileForm.phone} onChange={e => setEditProfileForm(f => ({ ...f, phone: e.target.value }))} className="input" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditProfileOpen(false)} className="flex-1 btn-secondary">{t('common.cancel')}</button>
                <button onClick={saveProfile} disabled={editProfileSaving} className="flex-1 btn-primary disabled:opacity-50">
                  {editProfileSaving ? t('common.saving') : 'Save'}
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
      {/* Add Training Modal */}
      <AddTrainingModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditTraining(null); }}
        onSaved={saved => { onTrainingSaved(saved); setModalOpen(false); }}
        initialClientId={id}
        editTraining={editTraining}
      />
    </div>
  );
}
