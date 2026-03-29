import { useState, useEffect } from 'react';
import { trainingService, templateService } from '../../services/trainingService';
import ExerciseBuilder from './ExerciseBuilder';
import { useTranslation } from 'react-i18next';

const WORKOUT_TYPES = ['Gym', 'Cardio', 'HIIT', 'Bodyweight', 'Custom'];

function toLocalInput(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toISOString().slice(0, 16);
}
function addHour(isoString) {
  const d = new Date(isoString || Date.now());
  d.setHours(d.getHours() + 1);
  return d.toISOString().slice(0, 16);
}

export default function AddTrainingModal({
  isOpen, onClose, onSaved,
  initialClientId = null, initialStartTime = null,
  editTraining = null, clients: clientsProp = null,
  sessionId = null, overrideEndTime = null,
}) {
  const { t } = useTranslation();
  const defaultStart = initialStartTime ? toLocalInput(initialStartTime) : new Date().toISOString().slice(0, 16);

  const [clients,  setClients]  = useState(clientsProp || []);
  const [templates, setTemplates] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName,   setTemplateName]   = useState('');

  const [form, setForm] = useState({
    clientId: initialClientId || '', title: '', workoutType: 'Gym',
    startTime: defaultStart,
    endTime: overrideEndTime ? toLocalInput(overrideEndTime) : addHour(defaultStart),
    notes: '', location: '', exercises: [],
  });

  useEffect(() => {
    if (!isOpen) return;
    if (!clientsProp) {
      fetch('/api/clients?active=true', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then(r => r.json())
        .then(data => setClients(Array.isArray(data) ? data : data.clients || data.data || []))
        .catch(() => {});
    }
    templateService.getAll().then(r => setTemplates(r.data)).catch(() => {});
    if (editTraining) {
      setForm({
        clientId: editTraining.client_id || '', title: editTraining.title || '',
        workoutType: editTraining.workout_type || 'Gym',
        startTime: toLocalInput(editTraining.start_time), endTime: toLocalInput(editTraining.end_time),
        notes: editTraining.notes || '', location: editTraining.location || '',
        exercises: (editTraining.exercises || []).map(ex => ({
          exerciseId: ex.exercise_id, exerciseName: ex.exercise_name, notes: ex.notes || '',
          sets: (ex.sets || []).map(s => ({
            reps: s.reps ?? '', weight: s.weight ?? '',
            durationSeconds: s.duration_seconds ?? '', distance: s.distance ?? '',
            rpe: s.rpe ?? '', notes: s.notes || '',
          })),
        })),
      });
    } else {
      const start = initialStartTime ? toLocalInput(initialStartTime) : new Date().toISOString().slice(0, 16);
      setForm({ clientId: initialClientId || '', title: '', workoutType: 'Gym', startTime: start, endTime: addHour(start), notes: '', location: '', exercises: [] });
    }
    setError(''); setSaveAsTemplate(false); setTemplateName('');
  }, [isOpen, editTraining]); // eslint-disable-line

  async function applyTemplate(templateId) {
    if (!templateId) return;
    try {
      const { data: tmpl } = await templateService.getById(templateId);
      setForm(f => ({
        ...f, workoutType: tmpl.workout_type,
        exercises: (tmpl.exercises || []).map(ex => ({
          exerciseId: ex.exercise_id, exerciseName: ex.exercise_name, notes: ex.notes || '',
          sets: (ex.sets || []).map(s => ({ reps: s.reps ?? '', weight: s.weight ?? '', durationSeconds: s.duration_seconds ?? '', distance: s.distance ?? '', rpe: s.rpe ?? '' })),
        })),
      }));
    } catch { setError('Failed to load template'); }
  }

  async function handleSave() {
    setError('');
    if (!form.clientId)              return setError(t('sessions.selectClient'));
    if (!form.startTime)             return setError('Start time is required');
    if (!form.endTime)               return setError('End time is required');
    if (form.endTime <= form.startTime) return setError('End time must be after start time');
    if (form.exercises.length === 0) return setError('Add at least one exercise');
    if (saveAsTemplate && !templateName.trim()) return setError('Enter a template name');
    setSaving(true);
    try {
      const payload = {
        ...form, sessionId: sessionId || undefined,
        exercises: form.exercises.map(ex => ({
          ...ex, sets: ex.sets.map(s => ({
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
      if (editTraining) { result = await trainingService.update(editTraining.id, payload); }
      else              { result = await trainingService.create(payload); }
      if (saveAsTemplate && !editTraining) {
        const { templateService: ts } = await import('../../services/trainingService');
        await ts.create({ name: templateName.trim(), workoutType: form.workoutType, exercises: payload.exercises });
      }
      onSaved(result.data);
      onClose();
    } catch (e) { setError(e.response?.data?.error || t('common.error')); }
    finally { setSaving(false); }
  }

  if (!isOpen) return null;

  const inputCls = "w-full border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[95vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {editTraining ? `${t('common.edit')} ${t('training.title').slice(0, -1)}` : t('training.addTraining')}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none font-light">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2.5 rounded-xl text-sm">{error}</div>
          )}

          {/* Client */}
          {!initialClientId && (
            <div>
              <label className={labelCls}>{t('sessions.client')} <span className="text-red-400">*</span></label>
              <select className={inputCls} value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">{t('sessions.selectClient')}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
          )}

          {/* Template */}
          {!editTraining && templates.length > 0 && (
            <div>
              <label className={labelCls}>Use Template</label>
              <select className={inputCls} defaultValue="" onChange={e => applyTemplate(e.target.value)}>
                <option value="">Choose a template ({t('common.optional')})...</option>
                {templates.map(tmpl => <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>)}
              </select>
            </div>
          )}

          {/* Title + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Title</label>
              <input className={inputCls} placeholder="e.g. Leg Day" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Type <span className="text-red-400">*</span></label>
              <select className={inputCls} value={form.workoutType} onChange={e => setForm(f => ({ ...f, workoutType: e.target.value }))}>
                {WORKOUT_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </div>
          </div>

          {/* Date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('sessions.startTime')} <span className="text-red-400">*</span></label>
              <input type="datetime-local" className={inputCls} value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>{t('sessions.endTime')} <span className="text-red-400">*</span></label>
              <input type="datetime-local" className={inputCls} value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>

          {/* Location */}
          <input className={inputCls} placeholder={`Location (${t('common.optional')})`}
            value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />

          {/* Notes */}
          <textarea className={`${inputCls} resize-none h-20`}
            placeholder={t('sessions.notesPlaceholder')} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          {/* Exercises */}
          <div className="pl-6">
            <ExerciseBuilder workoutType={form.workoutType} exercises={form.exercises}
              onChange={exs => setForm(f => ({ ...f, exercises: exs }))} />
          </div>

          {/* Save as template */}
          {!editTraining && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Save as template</span>
              </label>
              {saveAsTemplate && (
                <input className={`${inputCls} mt-2`} placeholder="Template name..."
                  value={templateName} onChange={e => setTemplateName(e.target.value)} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full btn-primary py-3.5 text-base font-semibold disabled:opacity-50">
            {saving ? t('common.saving') : editTraining ? `${t('common.save')} ${t('training.title').slice(0, -1)}` : t('training.addTraining')}
          </button>
        </div>
      </div>
    </div>
  );
}
