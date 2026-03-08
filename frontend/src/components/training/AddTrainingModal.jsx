import { useState, useEffect } from 'react';
import { trainingService, templateService } from '../../services/trainingService';
import ExerciseBuilder from './ExerciseBuilder';

const WORKOUT_TYPES = ['Gym', 'Cardio', 'HIIT', 'Bodyweight', 'Custom'];

function toLocalInput(isoString) {
  if (!isoString) return '';
  // Convert ISO string to datetime-local input value (YYYY-MM-DDTHH:MM)
  return new Date(isoString).toISOString().slice(0, 16);
}

function addHour(isoString) {
  const d = new Date(isoString || Date.now());
  d.setHours(d.getHours() + 1);
  return d.toISOString().slice(0, 16);
}

/**
 * AddTrainingModal
 *
 * Props:
 *   isOpen          {boolean}
 *   onClose         {() => void}
 *   onSaved         {(training) => void}
 *   initialClientId {string|null}   — locks the client dropdown
 *   initialStartTime{string|null}   — ISO or datetime-local string from calendar click
 *   editTraining    {object|null}   — full training object for edit mode
 *   clients         {Array|null}    — optional pre-fetched clients list
 */
export default function AddTrainingModal({
  isOpen,
  onClose,
  onSaved,
  initialClientId = null,
  initialStartTime = null,
  editTraining = null,
  clients: clientsProp = null,
}) {
  const defaultStart = initialStartTime
    ? toLocalInput(initialStartTime)
    : new Date().toISOString().slice(0, 16);

  const [clients, setClients]     = useState(clientsProp || []);
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName]     = useState('');

  const [form, setForm] = useState({
    clientId:    initialClientId || '',
    title:       '',
    workoutType: 'Gym',
    startTime:   defaultStart,
    endTime:     addHour(defaultStart),
    notes:       '',
    location:    '',
    exercises:   [],
  });

  // ── Load clients + templates when modal opens ─────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Load clients unless pre-supplied
    if (!clientsProp) {
      fetch('/api/clients?active=true', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then((r) => r.json())
        .then(data => setClients(Array.isArray(data) ? data : data.clients || data.data || []))
        .catch(() => {});
    }

    templateService.getAll()
      .then((r) => setTemplates(r.data))
      .catch(() => {});

    // Populate form for edit
    if (editTraining) {
      setForm({
        clientId:    editTraining.client_id || '',
        title:       editTraining.title     || '',
        workoutType: editTraining.workout_type || 'Gym',
        startTime:   toLocalInput(editTraining.start_time),
        endTime:     toLocalInput(editTraining.end_time),
        notes:       editTraining.notes    || '',
        location:    editTraining.location || '',
        exercises:   (editTraining.exercises || []).map((ex) => ({
          exerciseId:   ex.exercise_id,
          exerciseName: ex.exercise_name,
          notes:        ex.notes || '',
          sets:         (ex.sets || []).map((s) => ({
            reps:            s.reps            ?? '',
            weight:          s.weight          ?? '',
            durationSeconds: s.duration_seconds ?? '',
            distance:        s.distance        ?? '',
            rpe:             s.rpe             ?? '',
            notes:           s.notes           || '',
          })),
        })),
      });
    } else {
      const start = initialStartTime
        ? toLocalInput(initialStartTime)
        : new Date().toISOString().slice(0, 16);
      setForm({
        clientId:    initialClientId || '',
        title:       '',
        workoutType: 'Gym',
        startTime:   start,
        endTime:     addHour(start),
        notes:       '',
        location:    '',
        exercises:   [],
      });
    }
    setError('');
    setSaveAsTemplate(false);
    setTemplateName('');
  }, [isOpen, editTraining]); // eslint-disable-line

  // ── Apply template ────────────────────────────────────────────────────────
  async function applyTemplate(templateId) {
    if (!templateId) return;
    try {
      const { data: tmpl } = await templateService.getById(templateId);
      setForm((f) => ({
        ...f,
        workoutType: tmpl.workout_type,
        exercises: (tmpl.exercises || []).map((ex) => ({
          exerciseId:   ex.exercise_id,
          exerciseName: ex.exercise_name,
          notes:        ex.notes || '',
          sets:         (ex.sets || []).map((s) => ({
            reps:            s.reps            ?? '',
            weight:          s.weight          ?? '',
            durationSeconds: s.duration_seconds ?? '',
            distance:        s.distance        ?? '',
            rpe:             s.rpe             ?? '',
          })),
        })),
      }));
    } catch {
      setError('Failed to load template');
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setError('');
    if (!form.clientId)              return setError('Please select a client');
    if (!form.startTime)             return setError('Start time is required');
    if (!form.endTime)               return setError('End time is required');
    if (form.endTime <= form.startTime) return setError('End time must be after start time');
    if (form.exercises.length === 0) return setError('Add at least one exercise');
    if (saveAsTemplate && !templateName.trim()) return setError('Enter a template name');

    setSaving(true);
    try {
      const payload = {
        ...form,
        exercises: form.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.map((s) => ({
            reps:            s.reps            !== '' ? Number(s.reps)            : null,
            weight:          s.weight          !== '' ? Number(s.weight)          : null,
            durationSeconds: s.durationSeconds !== '' ? Number(s.durationSeconds) : null,
            distance:        s.distance        !== '' ? Number(s.distance)        : null,
            rpe:             s.rpe             !== '' ? Number(s.rpe)             : null,
            notes:           s.notes           || null,
          })),
        })),
      };

      let result;
      if (editTraining) {
        result = await trainingService.update(editTraining.id, payload);
      } else {
        result = await trainingService.create(payload);
      }

      // Optionally save as template
      if (saveAsTemplate && !editTraining) {
        const { templateService: ts } = await import('../../services/trainingService');
        await ts.create({
          name:        templateName.trim(),
          workoutType: form.workoutType,
          exercises:   payload.exercises,
        });
      }

      onSaved(result.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[95vh] flex flex-col shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {editTraining ? 'Edit Training' : 'Add Training'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light"
          >
            ×
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Client selector */}
          {!initialClientId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Client <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full border border-gray-300 rounded-xl p-3 text-sm bg-white"
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Template picker */}
          {!editTraining && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Use Template
              </label>
              <select
                className="w-full border border-gray-300 rounded-xl p-3 text-sm bg-white"
                defaultValue=""
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">Choose a template (optional)...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
              <input
                className="w-full border border-gray-300 rounded-xl p-3 text-sm"
                placeholder="e.g. Leg Day"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Type <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full border border-gray-300 rounded-xl p-3 text-sm bg-white"
                value={form.workoutType}
                onChange={(e) => setForm((f) => ({ ...f, workoutType: e.target.value }))}
              >
                {WORKOUT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Start <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded-xl p-3 text-sm"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                End <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded-xl p-3 text-sm"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>

          {/* Location */}
          <input
            className="w-full border border-gray-300 rounded-xl p-3 text-sm"
            placeholder="Location (optional)"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />

          {/* Notes */}
          <textarea
            className="w-full border border-gray-300 rounded-xl p-3 text-sm resize-none h-20"
            placeholder="Session notes..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          {/* Exercises */}
          <div className="pl-6">
            <ExerciseBuilder
              workoutType={form.workoutType}
              exercises={form.exercises}
              onChange={(exs) => setForm((f) => ({ ...f, exercises: exs }))}
            />
          </div>

          {/* Save as template toggle */}
          {!editTraining && (
            <div className="border border-gray-200 rounded-xl p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 font-medium">Save as template</span>
              </label>
              {saveAsTemplate && (
                <input
                  className="w-full mt-2 border border-gray-300 rounded-lg p-2.5 text-sm"
                  placeholder="Template name..."
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Sticky footer ── */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold text-base transition-colors"
          >
            {saving ? 'Saving...' : editTraining ? 'Update Training' : 'Save Training'}
          </button>
        </div>
      </div>
    </div>
  );
}
