import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from '../components/training/AddTrainingModal';

const TYPE_COLORS = {
  Gym:        { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200'   },
  Cardio:     { bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200'  },
  HIIT:       { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'    },
  Bodyweight: { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-200' },
  Custom:     { bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200' },
};

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <p className="text-gray-800 text-sm mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function SetRow({ set }) {
  const fields = [];
  if (set.reps)             fields.push({ label: 'Reps',     value: set.reps });
  if (set.weight)           fields.push({ label: 'Weight',   value: `${set.weight} kg` });
  if (set.duration_seconds) fields.push({ label: 'Duration', value: `${set.duration_seconds}s` });
  if (set.distance)         fields.push({ label: 'Distance', value: `${set.distance} m` });
  if (set.rpe)              fields.push({ label: 'RPE',      value: `${set.rpe}/10` });

  return (
    <div className="flex items-center gap-4 py-2 px-3 rounded-lg bg-gray-50 text-sm">
      <span className="text-gray-400 font-medium w-8">#{set.sort_order + 1}</span>
      {fields.map((f) => (
        <div key={f.label} className="flex items-center gap-1">
          <span className="text-gray-400 text-xs">{f.label}</span>
          <span className="font-semibold text-gray-800">{f.value}</span>
        </div>
      ))}
      {fields.length === 0 && <span className="text-gray-400 italic text-xs">No metrics recorded</span>}
      {set.notes && <span className="text-gray-400 text-xs ml-auto italic">"{set.notes}"</span>}
    </div>
  );
}

function ExerciseCard({ ex, index }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <div>
            <p className="font-semibold text-gray-800">{ex.exercise_name}</p>
            {ex.category && (
              <p className="text-xs text-gray-400">{ex.category}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{ex.sets?.length || 0} sets</span>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-gray-100 pt-3">
          {ex.notes && (
            <p className="text-xs text-gray-500 italic mb-2">📝 {ex.notes}</p>
          )}
          {ex.sets && ex.sets.length > 0 ? (
            ex.sets.map((s, i) => <SetRow key={s.id || i} set={s} />)
          ) : (
            <p className="text-xs text-gray-400 italic py-2">No sets recorded</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrainingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [training,    setTraining]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [editOpen,    setEditOpen]    = useState(false);
  const [completing,  setCompleting]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => { loadTraining(); }, [id]);

  async function loadTraining() {
    try {
      setLoading(true);
      const { data } = await trainingService.getById(id);
      setTraining(data);
    } catch {
      setError('Training not found');
    } finally {
      setLoading(false);
    }
  }

  async function toggleComplete() {
    setCompleting(true);
    try {
      const updated = await trainingService.update(id, { isCompleted: !training.is_completed });
      setTraining(updated.data);
      if (training.session_id) {
        const { sessionsAPI } = await import('../services/api');
        await sessionsAPI.update(training.session_id, { isCompleted: !training.is_completed });
      }
    } finally {
      setCompleting(false);
    }
  }

  async function confirmDelete() {
    await trainingService.delete(id);
    navigate('/dashboard/trainings');
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-400 text-sm">
        Loading training...
      </div>
    );
  }

  if (error || !training) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 mb-4">{error || 'Training not found'}</p>
        <button onClick={() => navigate('/dashboard/trainings')} className="text-blue-600 text-sm">
          ← Back to Trainings
        </button>
      </div>
    );
  }

  const typeStyle = TYPE_COLORS[training.workout_type] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  const startDate = new Date(training.start_time);
  const endDate   = new Date(training.end_time);
  const duration  = Math.round((endDate - startDate) / 60000);
  const totalSets = training.exercises?.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0) || 0;

  return (
    <div className="max-w-3xl mx-auto px-4 pb-12">

      {/* Delete confirm modal */}
      {showConfirm && (
        <ConfirmModal
          message="Delete this training? This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Back */}
      <div className="flex items-center gap-2 mt-4 mb-6">
        <button
          onClick={() => navigate('/dashboard/trainings')}
          className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
        >
          ← Trainings
        </button>
      </div>

      {/* Header card */}
      <div className={`rounded-2xl border p-6 mb-6 ${typeStyle.bg} ${typeStyle.border}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold uppercase tracking-wide ${typeStyle.text}`}>
                {training.workout_type}
              </span>
              {training.is_completed && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  ✓ Completed
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {training.title || `${training.first_name} ${training.last_name}'s Training`}
            </h1>
            <Link
              to={`/dashboard/clients/${training.client_id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              {training.first_name} {training.last_name}
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleComplete}
              disabled={completing}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                training.is_completed
                  ? 'border-gray-300 text-gray-600 hover:bg-gray-100 bg-white'
                  : 'border-green-400 text-green-600 hover:bg-green-50 bg-white'
              }`}
            >
              {completing ? '...' : training.is_completed ? '✓ Done' : 'Mark Done'}
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
            >
              Edit
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-white border border-red-200 hover:bg-red-50 text-red-500"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <span>📅</span>
            <span>
              {startDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>🕐</span>
            <span>
              {startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {' '}
              <span className="text-gray-400">({duration} min)</span>
            </span>
          </div>
          {training.location && (
            <div className="flex items-center gap-1.5">
              <span>📍</span>
              <span>{training.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Exercises', value: training.exercises?.length || 0 },
          { label: 'Total Sets', value: totalSets },
          { label: 'Duration',   value: `${duration}m` },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Notes */}
      {training.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-700">{training.notes}</p>
        </div>
      )}

      {/* Exercises */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Exercises
        </h2>
        {training.exercises && training.exercises.length > 0 ? (
          <div className="space-y-3">
            {training.exercises.map((ex, i) => (
              <ExerciseCard key={ex.id} ex={ex} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">No exercises recorded</p>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <AddTrainingModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(t) => { setTraining(t); setEditOpen(false); }}
          editTraining={training}
        />
      )}
    </div>
  );
}
