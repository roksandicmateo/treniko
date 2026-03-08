import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from '../components/training/AddTrainingModal';
import ProgressChart from '../components/progress/ProgressChart';

const TABS = ['profile', 'trainings', 'progress'];

const TYPE_COLORS = {
  Gym:        'bg-blue-100 text-blue-700',
  Cardio:     'bg-green-100 text-green-700',
  HIIT:       'bg-red-100 text-red-700',
  Bodyweight: 'bg-purple-100 text-purple-700',
  Custom:     'bg-yellow-100 text-yellow-700',
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client,       setClient]       = useState(null);
  const [trainings,    setTrainings]    = useState([]);
  const [tab,          setTab]          = useState('profile');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTraining, setEditTraining] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [clientRes, trainingsRes] = await Promise.all([
        fetch(`/api/clients/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then((r) => {
          if (!r.ok) throw new Error('Client not found');
          return r.json();
        }),
        trainingService.getAll({ clientId: id }),
      ]);
      setClient(clientRes);
      setTrainings(trainingsRes.data);
    } catch (e) {
      setError(e.message || 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function onTrainingSaved(t) {
    setTrainings((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      return idx >= 0
        ? prev.map((x, i) => (i === idx ? t : x))
        : [t, ...prev];
    });
  }

  async function openEdit(trainingId) {
    try {
      const { data } = await trainingService.getById(trainingId);
      setEditTraining(data);
      setModalOpen(true);
    } catch { /* ignore */ }
  }

  async function deactivateClient() {
    if (!window.confirm(`Deactivate ${client.first_name} ${client.last_name}? They will be hidden from active lists.`)) return;
    await fetch(`/api/clients/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    navigate('/clients');
  }

  const upcoming = trainings.filter(
    (t) => !t.is_completed && new Date(t.start_time) >= new Date()
  );
  const past = trainings.filter(
    (t) => t.is_completed || new Date(t.start_time) < new Date()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate('/clients')} className="text-blue-600 hover:underline">
          ← Back to clients
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="text-gray-400 hover:text-gray-600 text-sm mt-4 mb-4 flex items-center gap-1"
      >
        ← Back
      </button>

      {/* Client header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-600 font-bold text-2xl">
            {client.first_name?.[0]}{client.last_name?.[0]}
          </span>
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {client.first_name} {client.last_name}
              </h1>
              {client.email && (
                <p className="text-gray-500 text-sm">{client.email}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  client.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {client.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-gray-300 text-xs">
                  {trainings.length} training{trainings.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {client.is_active && (
                <button
                  onClick={() => { setEditTraining(null); setModalOpen(true); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
                >
                  + Training
                </button>
              )}
              <div className="relative group">
                <button className="border border-gray-300 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-xl text-sm">
                  ···
                </button>
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-10 hidden group-hover:block">
                  <button
                    onClick={() => navigate(`/clients/${id}/edit`)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 first:rounded-t-xl"
                  >
                    Edit profile
                  </button>
                  <button
                    onClick={deactivateClient}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 last:rounded-b-xl"
                  >
                    Deactivate client
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{trainings.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {trainings.filter((t) => t.is_completed).length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Completed</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{upcoming.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Upcoming</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {tab === 'profile' && (
        <div className="space-y-4">
          {[
            ['Phone',         client.phone],
            ['Date of Birth', client.date_of_birth
              ? new Date(client.date_of_birth).toLocaleDateString()
              : null],
            ['Notes',         client.notes],
          ].map(([label, value]) =>
            value ? (
              <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-gray-800 text-sm">{value}</p>
              </div>
            ) : null
          )}

          {!client.phone && !client.date_of_birth && !client.notes && (
            <p className="text-gray-400 text-sm text-center py-8">
              No additional info.{' '}
              <button
                onClick={() => navigate(`/clients/${id}/edit`)}
                className="text-blue-600 hover:underline"
              >
                Edit profile
              </button>
            </p>
          )}
        </div>
      )}

      {/* ── TRAININGS TAB ── */}
      {tab === 'trainings' && (
        <div>
          {trainings.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-400 text-sm mb-3">No trainings yet</p>
              {client.is_active && (
                <button
                  onClick={() => { setEditTraining(null); setModalOpen(true); }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium"
                >
                  + Add First Training
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {trainings.map((t) => (
                <div
                  key={t.id}
                  onClick={() => openEdit(t.id)}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {t.title || t.workout_type}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(t.start_time).toLocaleString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit', hour12: false,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[t.workout_type] || 'bg-gray-100 text-gray-600'}`}>
                      {t.workout_type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.is_completed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {t.is_completed ? 'Done' : 'Sched.'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PROGRESS TAB ── */}
      {tab === 'progress' && (
        <ProgressChart clientId={id} />
      )}

      {/* Modal */}
      <AddTrainingModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditTraining(null); }}
        onSaved={(t) => { onTrainingSaved(t); setModalOpen(false); }}
        initialClientId={id}
        editTraining={editTraining}
      />
    </div>
  );
}
