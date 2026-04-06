import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { trainingService } from '../services/trainingService';
import { sessionsAPI } from '../services/api';
import AddTrainingModal from '../components/training/AddTrainingModal';
import ConfirmModal from '../components/ConfirmModal';
import { TrainingListSkeleton } from '../components/SkeletonLoader';

const TYPE_COLORS = {
  Gym:        'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  Cardio:     'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  HIIT:       'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  Bodyweight: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  Custom:     'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
};

const PAGE_SIZE = 25;

export default function TrainingsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [trainings,    setTrainings]    = useState([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('All');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [search,       setSearch]       = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const FILTER_KEYS = ['All', 'Upcoming', 'Past', 'Completed'];
  const FILTER_LABELS = {
    All:       () => t('common.all'),
    Upcoming:  () => t('training.upcoming'),
    Past:      () => t('training.past'),
    Completed: () => t('training.completed'),
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      const now = new Date().toISOString();
      if (filter === 'Upcoming') params.from = now;
      else if (filter === 'Past') params.to = now;

      const res = await trainingService.getAll(params);
      const raw = res.data;
      let rows = Array.isArray(raw) ? raw : (raw.data || []);
      const totalCount = Array.isArray(raw) ? rows.length : (raw.total || rows.length);

      if (filter === 'Completed') rows = rows.filter(row => row.is_completed);
      if (typeFilter) rows = rows.filter(row => row.workout_type === typeFilter);

      setTrainings(rows);
      setTotal(totalCount);
    } catch (err) {
      console.error('Failed to load trainings:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [filter, typeFilter]);

  function confirmDelete(id, e) {
    e.stopPropagation();
    setDeleteTarget(id);
    setConfirmOpen(true);
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    await trainingService.delete(deleteTarget);
    setTrainings(prev => prev.filter(row => row.id !== deleteTarget));
    setTotal(prev => prev - 1);
    setConfirmOpen(false);
    setDeleteTarget(null);
  }

  async function toggleCompleted(training, e) {
    e.stopPropagation();
    const updated = await trainingService.update(training.id, { isCompleted: !training.is_completed });
    setTrainings(prev => prev.map(row => row.id === training.id ? updated.data : row));
    if (training.session_id) {
      try {
        await sessionsAPI.update(training.session_id, { isCompleted: !training.is_completed });
      } catch (err) {
        console.warn('Could not sync session:', err);
      }
    }
  }

  const types = [...new Set(trainings.map(row => row.workout_type).filter(Boolean))];
  const locale = i18n.language === 'hr' ? 'hr-HR' : i18n.language === 'de' ? 'de-DE' : 'en-GB';
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8">
      <div className="flex items-center justify-between mt-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('training.title')}</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm">{total} {t('training.sessions')}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">{t('training.addTraining')}</button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text" value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder={`${t('common.search')}...`}
          className="input pl-9"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        {searchInput && (
          <button onClick={() => { setSearchInput(''); setSearch(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTER_KEYS.map(key => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {FILTER_LABELS[key]()}
          </button>
        ))}
        {types.length > 0 && <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 self-center" />}
        {types.map(type => (
          <button key={type} onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              typeFilter === type
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {type}
          </button>
        ))}
      </div>

      {loading ? (
        <TrainingListSkeleton rows={6} />
      ) : trainings.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          {search ? (
            <>
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">{t('common.noResults')}</p>
              <button onClick={() => { setSearchInput(''); setSearch(''); }} className="text-sm text-blue-600 hover:underline">
                {t('common.clearSearch')}
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">{t('training.noTrainings')}</p>
              <button onClick={() => setModalOpen(true)} className="btn-primary">{t('training.addTraining')}</button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {trainings.map(training => (
              <div key={training.id} onClick={() => navigate(`/dashboard/trainings/${training.id}`)}
                className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors group">
                <button onClick={e => toggleCompleted(training, e)}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                    training.is_completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                  }`}>
                  {training.is_completed && <span className="text-white text-xs flex items-center justify-center w-full h-full">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-medium truncate ${training.is_completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                      {training.title || `${training.first_name} ${training.last_name}`}
                    </p>
                    {training.title && <span className="text-gray-400 dark:text-gray-500 text-xs">{training.first_name} {training.last_name}</span>}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(training.start_time).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                    {training.location && ` · ${training.location}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium hidden sm:inline-flex ${TYPE_COLORS[training.workout_type] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                    {training.workout_type}
                  </span>
                  <button onClick={e => confirmDelete(training.id, e)}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">🗑</button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('common.showing')} {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} {t('common.of')} {total}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">←</button>
                {[...Array(totalPages)].map((_, idx) => {
                  const pg = idx + 1;
                  if (totalPages <= 7 || Math.abs(pg - page) <= 2 || pg === 1 || pg === totalPages) {
                    return (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={`w-8 h-8 text-sm rounded-lg font-medium ${page === pg ? 'bg-blue-600 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        {pg}
                      </button>
                    );
                  }
                  if (Math.abs(pg - page) === 3) return <span key={pg} className="text-gray-400 px-1">…</span>;
                  return null;
                })}
                <button onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">→</button>
              </div>
            </div>
          )}
        </>
      )}

      <AddTrainingModal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        onSaved={training => { setModalOpen(false); navigate(`/dashboard/trainings/${training.id}`); }} />

      <ConfirmModal isOpen={confirmOpen}
        title={t('common.delete')}
        message={t('training.deleteConfirm')}
        confirmText={t('common.delete')} type="danger"
        onConfirm={handleDeleteConfirmed}
        onClose={() => { setConfirmOpen(false); setDeleteTarget(null); }} />
    </div>
  );
}
