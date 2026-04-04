// frontend/src/pages/GroupSessionDetail.jsx
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast';
import ExerciseBuilder from '../components/training/ExerciseBuilder';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const token   = () => localStorage.getItem('token');

const WORKOUT_TYPES = ['Gym', 'Cardio', 'HIIT', 'Bodyweight', 'Custom'];
const SESSION_TYPES = ['Strength Training', 'Cardio', 'HIIT', 'Yoga', 'Pilates', 'Boxing', 'Consultation', 'Other'];

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
  no_show:   { label: 'No-show',   color: 'bg-red-100 text-red-600' },
};

export default function GroupSessionDetail() {
  const { t } = useTranslation();
  const { groupId, sessionId } = useParams();
  const navigate = useNavigate();

  const [session,    setSession]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  // Form state
  const [workoutType,  setWorkoutType]  = useState('Gym');
  const [sessionType,  setSessionType]  = useState('');
  const [location,     setLocation]     = useState('');
  const [notes,        setNotes]        = useState('');
  const [exercises,    setExercises]    = useState([]);
  const [attendance,   setAttendance]   = useState([]); // [{clientId, status, notes}]
  const [sessionStatus, setSessionStatus] = useState('scheduled');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/groups/${groupId}/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) { navigate(`/dashboard/groups/${groupId}`); return; }

      const s = data.session;
      setSession(s);
      setWorkoutType(s.workout_type || 'Gym');
      setSessionType(s.session_type || '');
      setLocation(s.location || '');
      setNotes(s.notes || '');
      setSessionStatus(s.status || 'scheduled');
      setExercises(s.exercises || []);

      // Init attendance — default all to current status (or 'completed' if not set)
      setAttendance((s.attendance || []).map(a => ({
        clientId:   a.client_id,
        firstName:  a.first_name,
        lastName:   a.last_name,
        status:     a.status || 'scheduled',
        notes:      a.notes || '',
      })));
    } catch { navigate(`/dashboard/groups/${groupId}`); }
    finally { setLoading(false); }
  }, [groupId, sessionId, navigate]);

  useEffect(() => { load(); }, [load]);

  const toggleAttendance = (clientId) => {
    setAttendance(prev => prev.map(a =>
      a.clientId === clientId
        ? { ...a, status: a.status === 'completed' ? 'no_show' : 'completed' }
        : a
    ));
  };

  const markAllPresent = () => {
    setAttendance(prev => prev.map(a => ({ ...a, status: 'completed' })));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/groups/${groupId}/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercises,
          workoutType,
          sessionType: sessionType || null,
          location:    location || null,
          notes:       notes || null,
          status:      sessionStatus,
          attendance:  attendance.map(a => ({ clientId: a.clientId, status: a.status, notes: a.notes })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      showToast('Session saved', 'success');
    } catch { setError('Failed to save session'); }
    finally { setSaving(false); }
  };

  const handleMarkAllComplete = () => {
    markAllPresent();
    setSessionStatus('completed');
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400">{t('common.loading')}</div>;
  if (!session) return null;

  const attendedCount = attendance.filter(a => a.status === 'completed').length;
  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtT = (t) => t?.slice(0, 5) || '';

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(`/dashboard/groups/${groupId}`)}
          className="text-gray-400 hover:text-gray-600 text-sm">← Group</button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: session.group_color || '#0ea5e9' }}>
            👥
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{session.group_name}</h1>
            <p className="text-sm text-gray-400">
              {fmtDate(session.session_date)} · {fmtT(session.start_time)} – {fmtT(session.end_time)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleMarkAllComplete}
            className="btn-secondary text-sm">✅ Mark All Complete</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary text-sm disabled:opacity-50">
            {saving ? t('common.saving') : 'Save Session'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>}

      <div className="grid sm:grid-cols-2 gap-5">

        {/* Left: Attendance */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Attendance</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{attendedCount}/{attendance.length} present</p>
            </div>
            <div className="flex gap-1">
              <button onClick={markAllPresent}
                className="text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors">
                All ✓
              </button>
              <button onClick={() => setAttendance(prev => prev.map(a => ({ ...a, status: 'no_show' })))}
                className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
                All ✗
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {attendance.map(a => {
              const present = a.status === 'completed';
              return (
                <div key={a.clientId}
                  onClick={() => toggleAttendance(a.clientId)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    present ? 'hover:bg-green-50' : 'hover:bg-red-50 opacity-60'
                  }`}>
                  {/* Checkbox */}
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    present ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}>
                    {present && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    present ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {a.firstName[0]}{a.lastName[0]}
                  </div>
                  <p className={`text-sm font-medium flex-1 ${present ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                    {a.firstName} {a.lastName}
                  </p>
                  {/* Status badge for non-binary states */}
                  {(a.status === 'cancelled' || a.status === 'no_show') && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[a.status]?.color}`}>
                      {STATUS_CONFIG[a.status]?.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Session info */}
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Session Details</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Workout Type</label>
                <select value={workoutType} onChange={e => setWorkoutType(e.target.value)} className="input text-sm">
                  {WORKOUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Session Type</label>
                <select value={sessionType} onChange={e => setSessionType(e.target.value)} className="input text-sm">
                  <option value="">— optional —</option>
                  {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                className="input text-sm" placeholder="e.g. Main gym floor" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Session Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={3} className="input text-sm" placeholder="Workout plan, cues, observations..." />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <div className="flex gap-1.5">
                {['scheduled', 'completed', 'cancelled'].map(s => (
                  <button key={s} type="button" onClick={() => setSessionStatus(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors ${
                      sessionStatus === s
                        ? STATUS_CONFIG[s]?.color + ' border-current'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {STATUS_CONFIG[s]?.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exercise log */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Exercise Log</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Shared workout for all members</p>
          </div>
          {exercises.length > 0 && (
            <span className="text-xs text-gray-400">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="p-4">
          <ExerciseBuilder
            exercises={exercises}
            onChange={setExercises}
            workoutType={workoutType}
          />
        </div>
      </div>

      {/* Save button at bottom for convenience */}
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => navigate(`/dashboard/groups/${groupId}`)} className="btn-secondary">
          Back to Group
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? t('common.saving') : 'Save Session'}
        </button>
      </div>
    </div>
  );
}
