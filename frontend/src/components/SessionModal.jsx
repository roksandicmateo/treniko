import { useState, useEffect } from 'react';
import { sessionsAPI, clientsAPI } from '../services/api';
import { format } from 'date-fns';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from './training/AddTrainingModal';

const SessionModal = ({ session, initialDate, initialTime, onClose, onSave }) => {
  const [clients, setClients]         = useState([]);
  const [linkedTraining, setLinkedTraining] = useState(null);
  const [showAddTraining, setShowAddTraining] = useState(false);
  const [loadingTraining, setLoadingTraining] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    sessionDate: '',
    startTime: '',
    endTime: '',
    sessionType: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    loadClients();
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
      // Check if a training is already linked to this session
      loadLinkedTraining(session.id);
    } else if (initialDate) {
      const time    = initialTime ? format(initialTime, 'HH:mm') : '09:00';
      const endHour = initialTime
        ? format(new Date(initialTime.getTime() + 60 * 60 * 1000), 'HH:mm')
        : '10:00';
      setFormData({
        clientId: '', sessionDate: initialDate,
        startTime: time, endTime: endHour,
        sessionType: '', notes: '',
      });
    }
  }, [session, initialDate, initialTime]);

  const loadLinkedTraining = async (sessionId) => {
    setLoadingTraining(true);
    try {
      const { data } = await trainingService.getBySession(sessionId);
      setLinkedTraining(data);
    } catch {
      setLinkedTraining(null);
    } finally {
      setLoadingTraining(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await clientsAPI.getAll({ isActive: 'true' });
      setClients(response.data.clients);
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleMarkComplete = async () => {
    if (!session) return;
    setCompleting(true);
    try {
      await sessionsAPI.update(session.id, { ...formData, isCompleted: !session.isCompleted });
      // Also mark linked training as completed if exists
      if (linkedTraining) {
        await trainingService.update(linkedTraining.id, { isCompleted: !session.isCompleted });
      }
      onSave();
    } catch (err) {
      setError('Failed to update session');
    } finally {
      setCompleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (session) {
        await sessionsAPI.update(session.id, formData);
      } else {
        await sessionsAPI.create(formData);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    setLoading(true);
    try {
      await sessionsAPI.delete(session.id);
      onSave();
    } catch (err) {
      setError('Failed to delete session');
      setLoading(false);
    }
  };

  // Build start/end ISO strings from session date+time for AddTrainingModal
  const sessionStartISO = session
    ? `${session.sessionDate}T${session.startTime}`
    : null;
  const sessionEndISO = session
    ? `${session.sessionDate}T${session.endTime}`
    : null;

  const sessionTypes = [
    'Strength Training', 'Cardio', 'HIIT', 'Yoga',
    'Pilates', 'Boxing', 'Consultation', 'Other',
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {session ? 'Edit Session' : 'New Training Session'}
          </h2>

          {/* ── Linked Training Banner ── */}
          {session && (
            <div className="mb-5">
              {loadingTraining ? (
                <div className="text-xs text-gray-400">Checking training...</div>
              ) : linkedTraining ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-0.5">
                      Training logged
                    </p>
                    <p className="text-sm font-semibold text-green-800">
                      {linkedTraining.title || linkedTraining.workout_type}
                    </p>
                    {linkedTraining.exercises?.length > 0 && (
                      <p className="text-xs text-green-600">
                        {linkedTraining.exercises.length} exercise{linkedTraining.exercises.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddTraining(true)}
                    className="ml-3 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                  >
                    View →
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-500">No training logged for this session</p>
                  <button
                    type="button"
                    onClick={() => setShowAddTraining(true)}
                    className="ml-3 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                  >
                    + Add Training
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-2">
                Client *
              </label>
              <select
                id="clientId" name="clientId"
                value={formData.clientId}
                onChange={handleChange}
                required className="input"
                disabled={session !== null}
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.first_name} {client.last_name}
                  </option>
                ))}
              </select>
              {session && (
                <p className="text-xs text-gray-500 mt-1">Client: {session.clientName}</p>
              )}
            </div>

            <div>
              <label htmlFor="sessionDate" className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input type="date" id="sessionDate" name="sessionDate"
                value={formData.sessionDate} onChange={handleChange}
                required className="input" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time *
                </label>
                <input type="time" id="startTime" name="startTime"
                  value={formData.startTime} onChange={handleChange}
                  required className="input" />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                  End Time *
                </label>
                <input type="time" id="endTime" name="endTime"
                  value={formData.endTime} onChange={handleChange}
                  required className="input" />
              </div>
            </div>

            <div>
              <label htmlFor="sessionType" className="block text-sm font-medium text-gray-700 mb-2">
                Session Type
              </label>
              <select id="sessionType" name="sessionType"
                value={formData.sessionType} onChange={handleChange} className="input">
                <option value="">Select type (optional)</option>
                {sessionTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea id="notes" name="notes"
                value={formData.notes} onChange={handleChange}
                rows={3} className="input"
                placeholder="Session notes, goals, exercises..." />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <div className="flex space-x-3 pt-4">
              {session && (
                <button type="button" onClick={handleDelete}
                  className="btn-danger" disabled={loading}>
                  Delete
                </button>
              )}
              {session && (
                <button type="button" onClick={handleMarkComplete}
                  disabled={completing || loading}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    session.isCompleted
                      ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      : 'border-green-500 text-green-600 hover:bg-green-50'
                  }`}>
                  {completing ? '...' : session.isCompleted ? '✓ Completed' : 'Mark Done'}
                </button>
              )}
              <button type="button" onClick={onClose}
                className="flex-1 btn-secondary" disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="flex-1 btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Add/Edit Training Modal */}
      {showAddTraining && session && (
        <AddTrainingModal
          isOpen={showAddTraining}
          onClose={() => setShowAddTraining(false)}
          onSaved={(t) => {
            setLinkedTraining(t);
            setShowAddTraining(false);
          }}
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
