import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from '../components/training/AddTrainingModal';
import { useTranslation } from 'react-i18next';

const TYPE_COLORS = {
  Gym:        { bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-700 dark:text-blue-400',   border: 'border-blue-200 dark:border-blue-800' },
  Cardio:     { bg: 'bg-green-50 dark:bg-green-900/20',  text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  HIIT:       { bg: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-700 dark:text-red-400',     border: 'border-red-200 dark:border-red-800' },
  Bodyweight: { bg: 'bg-purple-50 dark:bg-purple-900/20',text: 'text-purple-700 dark:text-purple-400',border: 'border-purple-200 dark:border-purple-800' },
  Custom:     { bg: 'bg-yellow-50 dark:bg-yellow-900/20',text: 'text-yellow-700 dark:text-yellow-400',border: 'border-yellow-200 dark:border-yellow-800' },
};

async function recordPackageUsage(clientId) {
  try {
    const token = localStorage.getItem('token');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const res = await fetch(`${API_URL}/clients/${clientId}/packages/active`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.package) return;
    await fetch(`${API_URL}/clients/${clientId}/packages/${data.package.id}/use-session`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({})
    });
  } catch (err) { console.warn('Could not record package usage:', err); }
}

function SetRow({ set }) {
  const { t } = useTranslation();
  const fields = [];
  if (set.reps)             fields.push({ label: 'Reps',     value: set.reps });
  if (set.weight)           fields.push({ label: 'kg',       value: `${set.weight} kg` });
  if (set.duration_seconds) fields.push({ label: 'Sec',      value: `${set.duration_seconds}s` });
  if (set.distance)         fields.push({ label: 'km',       value: `${set.distance} m` });
  if (set.rpe)              fields.push({ label: 'RPE',      value: `${set.rpe}/10` });
  return (
    <div className="flex items-center gap-4 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm">
      <span className="text-gray-400 dark:text-gray-500 font-medium w-8">#{set.sort_order + 1}</span>
      {fields.map(f => (
        <div key={f.label} className="flex items-center gap-1">
          <span className="text-gray-400 dark:text-gray-500 text-xs">{f.label}</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">{f.value}</span>
        </div>
      ))}
      {fields.length === 0 && <span className="text-gray-400 dark:text-gray-500 italic text-xs">{t('training.noMetrics')}</span>}
      {set.notes && <span className="text-gray-400 dark:text-gray-500 text-xs ml-auto italic">"{set.notes}"</span>}
    </div>
  );
}

function ExerciseCard({ ex, index }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{index + 1}</span>
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-200">{ex.exercise_name}</p>
            {ex.category && <p className="text-xs text-gray-400 dark:text-gray-500">{ex.category}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">{ex.sets?.length || 0} {t('training.sets')}</span>
          <span className="text-gray-400 dark:text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-3 bg-white dark:bg-gray-900">
          {ex.notes && <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">📝 {ex.notes}</p>}
          {ex.sets && ex.sets.length > 0
            ? ex.sets.map((s, i) => <SetRow key={s.id || i} set={s} />)
            : <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">{t('training.noSets')}</p>}
        </div>
      )}
    </div>
  );
}

export default function TrainingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [training,    setTraining]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [editOpen,    setEditOpen]    = useState(false);
  const [completing,  setCompleting]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => { loadTraining(); }, [id]);

  async function loadTraining() {
    try { setLoading(true); const { data } = await trainingService.getById(id); setTraining(data); }
    catch { setError(t('common.noData')); }
    finally { setLoading(false); }
  }

  async function toggleComplete() {
    setCompleting(true);
    try {
      const updated = await trainingService.update(id, { isCompleted: !training.is_completed });
      setTraining(updated.data);
      if (!training.is_completed && training.client_id) await recordPackageUsage(training.client_id);
      if (training.session_id) {
        const { sessionsAPI } = await import('../services/api');
        await sessionsAPI.update(training.session_id, { isCompleted: !training.is_completed });
      }
    } finally { setCompleting(false); }
  }

  async function confirmDelete() {
    await trainingService.delete(id);
    navigate('/dashboard/trainings');
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-400 text-sm">{t('common.loading')}</div>;
  if (error || !training) return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center">
      <p className="text-gray-500 dark:text-gray-400 mb-4">{error || t('common.noData')}</p>
      <button onClick={() => navigate('/dashboard/trainings')} className="text-primary-500 text-sm">← {t('training.title')}</button>
    </div>
  );

  const typeStyle = TYPE_COLORS[training.workout_type] || { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700' };
  const startDate = new Date(training.start_time);
  const endDate   = new Date(training.end_time);
  const duration  = Math.round((endDate - startDate) / 60000);
  const totalSets = training.exercises?.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0) || 0;

  return (
    <div className="max-w-3xl mx-auto px-4 pb-12">

      {/* Delete confirm */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-800">
            <p className="text-gray-800 dark:text-gray-200 text-sm mb-5">{t('training.deleteConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={confirmDelete} className="btn-danger">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 mb-6">
        <button onClick={() => navigate('/dashboard/trainings')}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1">
          ← {t('training.title')}
        </button>
      </div>

      {/* Header */}
      <div className={`rounded-2xl border p-6 mb-6 ${typeStyle.bg} ${typeStyle.border}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold uppercase tracking-wide ${typeStyle.text}`}>{training.workout_type}</span>
              {training.is_completed && <span className="badge-green">✓ {t('sessions.completed')}</span>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {training.title || `${training.first_name} ${training.last_name}'s Training`}
            </h1>
            <Link to={`/dashboard/clients/${training.client_id}`} className="text-sm text-primary-500 hover:underline">
              {training.first_name} {training.last_name}
            </Link>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggleComplete} disabled={completing}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors bg-white dark:bg-gray-900 ${
                training.is_completed ? 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400' : 'border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
              }`}>
              {completing ? '...' : training.is_completed ? `✓ ${t('sessions.completed')}` : t('training.markDone')}
            </button>
            <button onClick={() => setEditOpen(true)} className="px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
              {t('common.edit')}
            </button>
            <button onClick={() => setShowConfirm(true)} className="px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
              {t('common.delete')}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <span>📅</span>
            <span>{startDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>🕐</span>
            <span>
              {startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – {endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              <span className="text-gray-400 dark:text-gray-500 ml-1">({duration} min)</span>
            </span>
          </div>
          {training.location && <div className="flex items-center gap-1.5"><span>📍</span><span>{training.location}</span></div>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: t('training.exercises'), value: training.exercises?.length || 0 },
          { label: t('training.sets'),      value: totalSets },
          { label: t('training.duration'),  value: `${duration}m` },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Notes */}
      {training.notes && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">{t('sessions.notes')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{training.notes}</p>
        </div>
      )}

      {/* Exercises */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t('training.exercises')}</h2>
        {training.exercises && training.exercises.length > 0 ? (
          <div className="space-y-3">{training.exercises.map((ex, i) => <ExerciseCard key={ex.id} ex={ex} index={i} />)}</div>
        ) : (
          <div className="text-center py-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-gray-400 dark:text-gray-500 text-sm">{t('training.noExercises')}</p>
          </div>
        )}
      </div>

      {editOpen && (
        <AddTrainingModal isOpen={editOpen} onClose={() => setEditOpen(false)}
          onSaved={t => { setTraining(t); setEditOpen(false); }} editTraining={training} />
      )}
    </div>
  );
}
