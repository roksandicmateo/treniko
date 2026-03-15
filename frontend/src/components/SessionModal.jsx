import { useState, useEffect } from 'react';
import { sessionsAPI, clientsAPI } from '../services/api';
import { format } from 'date-fns';
import { trainingService } from '../services/trainingService';
import AddTrainingModal from './training/AddTrainingModal';

const STATUS_CONFIG = {
  scheduled:  { label: 'Scheduled',  color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  completed:  { label: 'Completed',  color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  cancelled:  { label: 'Cancelled',  color: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400' },
  no_show:    { label: 'No-show',    color: 'bg-red-100 text-red-600',     dot: 'bg-red-500' },
};

const SessionModal = ({ session, initialDate, initialTime, onClose, onSave }) => {
  const [clients, setClients]               = useState([]);
  const [linkedTraining, setLinkedTraining] = useState(null);
  const [showAddTraining, setShowAddTraining] = useState(false);
  const [loadingTraining, setLoadingTraining] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '', sessionDate: '', startTime: '',
    endTime: '', sessionType: '', notes: '',
  });
  const [loading,    setLoading]    = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error,      setError]      = useState('');

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
      loadLinkedTraining(session.id);
    } else if (initialDate) {
      const time    = initialTime ? format(initialTime, 'HH:mm') : '09:00';
      const endHour = initialTime
        ? format(new Date(initialTime.getTime() + 60 * 60 * 1000), 'HH:mm')
        : '10:00';
      setFormData({ clientId: '', sessionDate: initialDate, startTime: time, endTime: endHour, sessionType: '', notes: '' });
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

  // Set session status (completed, cancelled, no_show, scheduled)
  const handleSetStatus = async (newStatus) => {
    if (!session) return;
    setStatusLoading(true);
    try {
      await sessionsAPI.update(session.id, { status: newStatus });
      // Sync linked training completion
      if (linkedTraining) {
        await trainingService.update(linkedTraining.id, { isCompleted: newStatus === 'completed' });
      }
      onSave();
    } catch {
      setError('Failed to update session status');
    } finally {
      setStatusLoading(false);
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
    } catch {
      setError('Failed to delete session');
      setLoading(false);
    }
  };

  const currentStatus = session?.status || (session?.isCompleted ? 'completed' : 'scheduled');
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.scheduled;

  const sessionStartISO = session ? `${session.sessionDate}T${session.startTime}` : null;
  const sessionEndISO   = session ? `${session.sessionDate}T${session.endTime}`   : null;

  const sessionTypes = ['Strength Training', 'Cardio', 'HIIT', 'Yoga', 'Pilates', 'Boxing', 'Consultation', 'Other'];

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              {session ? 'Edit Session' : 'New Training Session'}
            </h2>
            {session && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            )}
          </div>

          {/* ── Status actions for existing sessions ── */}
          {session && (
            <div className="mb-5">
              {/* Linked training banner */}
              {loadingTraining ? (
                <div className="text-xs text-gray-400 mb-3">Checking training...</div>
              ) : linkedTraining ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
                  <div>
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-0.5">Training logged</p>
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
                  <p className="text-sm text-gray-500">No training logged</p>
                  <button type="button" onClick={() => setShowAddTraining(true)}
                    className="ml-3 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                    + Add Training
                  </button>
                </div>
              )}

              {/* Status buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetStatus('completed')}
                  disabled={statusLoading || currentStatus === 'completed'}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition-colors ${
                    currentStatus === 'completed'
                      ? 'bg-green-100 border-green-300 text-green-700 cursor-default'
                      : 'border-green-300 text-green-600 hover:bg-green-50'
                  }`}
                >
                  ✅ Completed
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus('no_show')}
                  disabled={statusLoading || currentStatus === 'no_show'}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition-colors ${
                    currentStatus === 'no_show'
                      ? 'bg-red-100 border-red-300 text-red-700 cursor-default'
                      : 'border-red-300 text-red-500 hover:bg-red-50'
                  }`}
                >
                  ❌ No-show
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus('cancelled')}
                  disabled={statusLoading || currentStatus === 'cancelled'}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition-colors ${
                    currentStatus === 'cancelled'
                      ? 'bg-gray-100 border-gray-300 text-gray-600 cursor-default'
                      : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  🚫 Cancelled
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus('scheduled')}
                  disabled={statusLoading || currentStatus === 'scheduled'}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition-colors ${
                    currentStatus === 'scheduled'
                      ? 'bg-blue-100 border-blue-300 text-blue-700 cursor-default'
                      : 'border-blue-300 text-blue-500 hover:bg-blue-50'
                  }`}
                >
                  📅 Scheduled
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-2">Client *</label>
              <select id="clientId" name="clientId" value={formData.clientId}
                onChange={handleChange} required className="input" disabled={session !== null}>
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.first_name} {client.last_name}</option>
                ))}
              </select>
              {session && <p className="text-xs text-gray-500 mt-1">Client: {session.clientName}</p>}
            </div>

            <div>
              <label htmlFor="sessionDate" className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input type="date" id="sessionDate" name="sessionDate"
                value={formData.sessionDate} onChange={handleChange} required className="input" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                <input type="time" id="startTime" name="startTime"
                  value={formData.startTime} onChange={handleChange} required className="input" />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
                <input type="time" id="endTime" name="endTime"
                  value={formData.endTime} onChange={handleChange} required className="input" />
              </div>
            </div>

            <div>
              <label htmlFor="sessionType" className="block text-sm font-medium text-gray-700 mb-2">Session Type</label>
              <select id="sessionType" name="sessionType" value={formData.sessionType} onChange={handleChange} className="input">
                <option value="">Select type (optional)</option>
                {sessionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange}
                rows={3} className="input" placeholder="Session notes, goals, exercises..." />
            </div>

            {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="flex space-x-3 pt-2">
              {session && (
                <button type="button" onClick={handleDelete} className="btn-danger" disabled={loading}>
                  Delete
                </button>
              )}
              <button type="button" onClick={onClose} className="flex-1 btn-secondary" disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="flex-1 btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showAddTraining && session && (
        <AddTrainingModal
          isOpen={showAddTraining}
          onClose={() => setShowAddTraining(false)}
          onSaved={(t) => { setLinkedTraining(t); setShowAddTraining(false); }}
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
