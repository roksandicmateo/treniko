import { useState, useEffect, useCallback } from 'react';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from '../components/training/AddTrainingModal';

const TYPE_COLORS = {
  Gym:        'bg-blue-100 text-blue-700',
  Cardio:     'bg-green-100 text-green-700',
  HIIT:       'bg-red-100 text-red-700',
  Bodyweight: 'bg-purple-100 text-purple-700',
  Custom:     'bg-yellow-100 text-yellow-700',
};

const FILTERS = ['All', 'Upcoming', 'Past', 'Completed'];

export default function TrainingsPage() {
  const [trainings,    setTrainings]    = useState([]);
  const [filtered,     setFiltered]     = useState([]);
  const [filter,       setFilter]       = useState('All');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [loading,      setLoading]      = useState(true);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTraining, setEditTraining] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await trainingService.getAll();
      setTrainings(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const now = new Date();
    let result = [...trainings];

    if (filter === 'Upcoming') {
      result = result.filter((t) => !t.is_completed && new Date(t.start_time) >= now);
    } else if (filter === 'Past') {
      result = result.filter((t) => !t.is_completed && new Date(t.start_time) < now);
    } else if (filter === 'Completed') {
      result = result.filter((t) => t.is_completed);
    }

    if (typeFilter) {
      result = result.filter((t) => t.workout_type === typeFilter);
    }

    setFiltered(result);
  }, [trainings, filter, typeFilter]);

  async function openEdit(id) {
    const { data } = await trainingService.getById(id);
    setEditTraining(data);
    setModalOpen(true);
  }

  async function deleteTraining(id, e) {
    e.stopPropagation();
    if (!window.confirm('Delete this training?')) return;
    await trainingService.delete(id);
    setTrainings((prev) => prev.filter((t) => t.id !== id));
  }

  async function toggleCompleted(t, e) {
    e.stopPropagation();
    const updated = await trainingService.update(t.id, { isCompleted: !t.is_completed });
    setTrainings((prev) => prev.map((x) => (x.id === t.id ? updated.data : x)));
    // Sync linked calendar session if exists
    if (t.session_id) {
      try {
        await import('../services/api').then(({ sessionsAPI }) =>
          sessionsAPI.update(t.session_id, { isCompleted: !t.is_completed })
        );
      } catch (err) {
        console.warn('Could not sync session completion:', err);
      }
    }
  }

  const types = [...new Set(trainings.map((t) => t.workout_type))];

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mt-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trainings</h1>
          <p className="text-gray-400 text-sm">{filtered.length} sessions</p>
        </div>
        <button
          onClick={() => { setEditTraining(null); setModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium text-sm"
        >
          + Add Training
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}

        <div className="h-6 w-px bg-gray-200 self-center" />

        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              typeFilter === t
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-400 text-sm mb-3">No trainings found</p>
          <button
            onClick={() => { setEditTraining(null); setModalOpen(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            + Add Training
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div
              key={t.id}
              onClick={() => openEdit(t.id)}
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              {/* Completed toggle */}
              <button
                onClick={(e) => toggleCompleted(t, e)}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                  t.is_completed
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 hover:border-green-400'
                }`}
                title={t.is_completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {t.is_completed && (
                  <span className="text-white text-xs flex items-center justify-center w-full h-full">✓</span>
                )}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-medium truncate ${t.is_completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {t.title || `${t.first_name} ${t.last_name}`}
                  </p>
                  {t.title && (
                    <span className="text-gray-400 text-xs truncate">
                      {t.first_name} {t.last_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(t.start_time).toLocaleString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit', hour12: false,
                  })}
                  {t.location && ` · ${t.location}`}
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium hidden sm:inline-flex ${TYPE_COLORS[t.workout_type] || 'bg-gray-100 text-gray-600'}`}>
                  {t.workout_type}
                </span>

                {/* Delete button (visible on hover) */}
                <button
                  onClick={(e) => deleteTraining(t.id, e)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddTrainingModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditTraining(null); }}
        onSaved={(t) => {
          setTrainings((prev) => {
            const idx = prev.findIndex((x) => x.id === t.id);
            return idx >= 0 ? prev.map((x, i) => (i === idx ? t : x)) : [t, ...prev];
          });
          setModalOpen(false);
        }}
        editTraining={editTraining}
      />
    </div>
  );
}
