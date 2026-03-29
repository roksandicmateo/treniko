import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from '../components/training/AddTrainingModal';
import ConfirmModal from '../components/ConfirmModal';

const TYPE_COLORS = {
  Gym:        'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  Cardio:     'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  HIIT:       'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  Bodyweight: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  Custom:     'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
};

export default function TrainingsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [trainings,    setTrainings]    = useState([]);
  const [filtered,     setFiltered]     = useState([]);
  const [filter,       setFilter]       = useState('All');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [loading,      setLoading]      = useState(true);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const FILTERS = [
    { key: 'All',       label: t('common.all') },
    { key: 'Upcoming',  label: t('training.upcoming') },
    { key: 'Past',      label: t('training.past') },
    { key: 'Completed', label: t('training.completed') },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await trainingService.getAll(); setTrainings(data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const now = new Date();
    let result = [...trainings];
    if (filter === 'Upcoming') result = result.filter(tr => !tr.is_completed && new Date(tr.start_time) >= now);
    else if (filter === 'Past') result = result.filter(tr => !tr.is_completed && new Date(tr.start_time) < now);
    else if (filter === 'Completed') result = result.filter(tr => tr.is_completed);
    if (typeFilter) result = result.filter(tr => tr.workout_type === typeFilter);
    setFiltered(result);
  }, [trainings, filter, typeFilter]);

  function confirmDelete(id, e) { e.stopPropagation(); setDeleteTarget(id); setConfirmOpen(true); }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    await trainingService.delete(deleteTarget);
    setTrainings(prev => prev.filter(tr => tr.id !== deleteTarget));
    setConfirmOpen(false); setDeleteTarget(null);
  }

  async function toggleCompleted(tr, e) {
    e.stopPropagation();
    const updated = await trainingService.update(tr.id, { isCompleted: !tr.is_completed });
    setTrainings(prev => prev.map(x => x.id === tr.id ? updated.data : x));
    if (tr.session_id) {
      try { await import('../services/api').then(({ sessionsAPI }) => sessionsAPI.update(tr.session_id, { isCompleted: !tr.is_completed })); }
      catch (err) { console.warn('Could not sync:', err); }
    }
  }

  const types = [...new Set(trainings.map(tr => tr.workout_type))];
  const locale = i18n.language === 'hr' ? 'hr-HR' : i18n.language === 'de' ? 'de-DE' : 'en-GB';

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8">
      <div className="flex items-center justify-between mt-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('training.title')}</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm">{filtered.length} {t('training.sessions')}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">{t('training.addTraining')}</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {f.label}
          </button>
        ))}
        {types.length > 0 && <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 self-center" />}
        {types.map(type => (
          <button key={type} onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              typeFilter === type ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {type}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">{t('training.noTrainings')}</p>
          <button onClick={() => setModalOpen(true)} className="btn-primary">{t('training.addTraining')}</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tr => (
            <div key={tr.id} onClick={() => navigate(`/dashboard/trainings/${tr.id}`)}
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors group">
              <button onClick={e => toggleCompleted(tr, e)}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                  tr.is_completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                }`}>
                {tr.is_completed && <span className="text-white text-xs flex items-center justify-center w-full h-full">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-medium truncate ${tr.is_completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                    {tr.title || `${tr.first_name} ${tr.last_name}`}
                  </p>
                  {tr.title && <span className="text-gray-400 dark:text-gray-500 text-xs">{tr.first_name} {tr.last_name}</span>}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {new Date(tr.start_time).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                  {tr.location && ` · ${tr.location}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium hidden sm:inline-flex ${TYPE_COLORS[tr.workout_type] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                  {tr.workout_type}
                </span>
                <span className="text-gray-300 dark:text-gray-600 text-sm hidden sm:inline">›</span>
                <button onClick={e => confirmDelete(tr.id, e)}
                  className="text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddTrainingModal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        onSaved={tr => { setModalOpen(false); navigate(`/dashboard/trainings/${tr.id}`); }} />

      <ConfirmModal isOpen={confirmOpen} title={t('common.delete')} message={t('common.confirm')}
        confirmLabel={t('common.delete')} confirmClass="bg-red-600 hover:bg-red-700 text-white"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => { setConfirmOpen(false); setDeleteTarget(null); }} />
    </div>
  );
}
