import { useState, useCallback } from 'react';
import { exerciseService } from '../../services/trainingService';
import { useTranslation } from 'react-i18next';

const TYPE_FIELDS = {
  Gym:        ['reps', 'weight', 'rpe'],
  Cardio:     ['durationSeconds', 'distance', 'rpe'],
  HIIT:       ['durationSeconds', 'rpe'],
  Bodyweight: ['reps', 'rpe'],
  Custom:     ['reps', 'weight', 'durationSeconds', 'distance', 'rpe'],
};

const FIELD_LABELS = {
  reps:            'Reps',
  weight:          'kg',
  durationSeconds: 'Sec',
  distance:        'km',
  rpe:             'RPE',
};

function emptySet() {
  return { reps: '', weight: '', durationSeconds: '', distance: '', rpe: '' };
}

function ExerciseCard({ ex, exIdx, fields, onChange, onRemove }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  function updateSet(setIdx, field, value) {
    const updatedSets = ex.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s);
    onChange({ ...ex, sets: updatedSets });
  }
  function addSet() {
    const prev = ex.sets[ex.sets.length - 1] || {};
    onChange({ ...ex, sets: [...ex.sets, { ...emptySet(), weight: prev.weight || '', reps: prev.reps || '' }] });
  }
  function removeSet(setIdx) { onChange({ ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }); }
  function duplicateSet(setIdx) {
    const newSets = [...ex.sets]; newSets.splice(setIdx + 1, 0, { ...ex.sets[setIdx] }); onChange({ ...ex, sets: newSets });
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl mb-3 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">☰</span>
          <div>
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{ex.exerciseName}</span>
            <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">
              {ex.sets.length} {ex.sets.length === 1 ? 'set' : 'sets'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 dark:text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
          <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
            className="text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-2">
          {ex.sets.map((set, setIdx) => (
            <div key={setIdx} className="flex items-end gap-2 flex-wrap">
              <span className="text-gray-400 dark:text-gray-500 text-xs w-6 text-center pb-1.5">{setIdx + 1}</span>
              {fields.map(f => (
                <div key={f} className="flex-1 min-w-[52px]">
                  <label className="text-xs text-gray-400 dark:text-gray-500 block mb-0.5">{FIELD_LABELS[f]}</label>
                  <input type="number" inputMode="decimal" min="0"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm text-center bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-blue-400 focus:outline-none"
                    value={set[f] || ''} placeholder="—"
                    onChange={e => updateSet(setIdx, f, e.target.value)} />
                </div>
              ))}
              <div className="flex gap-1 pb-0.5">
                <button type="button" onClick={() => duplicateSet(setIdx)} title="Duplicate set"
                  className="text-gray-300 hover:text-blue-500 text-lg leading-none px-1">⧉</button>
                <button type="button" onClick={() => removeSet(setIdx)}
                  className="text-red-300 hover:text-red-500 font-bold text-lg leading-none px-1">×</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addSet} className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline mt-1">
            + {t('training.sets')}
          </button>
          <input className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 mt-1"
            placeholder={`${t('sessions.notes')} (${t('common.optional')})`}
            value={ex.notes || ''} onChange={e => onChange({ ...ex, notes: e.target.value })} />
        </div>
      )}
    </div>
  );
}

export default function ExerciseBuilder({ workoutType, exercises, onChange }) {
  const { t } = useTranslation();
  const [search,     setSearch]     = useState('');
  const [results,    setResults]    = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [creating,   setCreating]   = useState(false);

  const fields = TYPE_FIELDS[workoutType] || TYPE_FIELDS.Custom;

  const doSearch = useCallback(async (q) => {
    setSearch(q);
    if (q.length === 0) { setResults([]); return; }
    try { const { data } = await exerciseService.getAll({ search: q }); setResults(data); }
    catch { /* ignore */ }
  }, []);

  function addExercise(exercise) {
    onChange([...exercises, { exerciseId: exercise.id, exerciseName: exercise.name, notes: '', sets: [emptySet()] }]);
    setShowSearch(false); setSearch(''); setResults([]);
  }

  async function createAndAdd() {
    if (!search.trim() || creating) return;
    setCreating(true);
    try { const { data } = await exerciseService.create({ name: search.trim(), category: 'Strength' }); addExercise(data); }
    catch { /* ignore */ }
    finally { setCreating(false); }
  }

  function updateExercise(idx, updated) { onChange(exercises.map((ex, i) => i === idx ? updated : ex)); }
  function removeExercise(idx) { onChange(exercises.filter((_, i) => i !== idx)); }
  function moveExercise(idx, dir) {
    const arr = [...exercises]; const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]]; onChange(arr);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
          {t('form.exercises')}
          {exercises.length > 0 && <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({exercises.length})</span>}
        </h3>
        <button type="button" onClick={() => setShowSearch(s => !s)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          {t('form.addExercise')}
        </button>
      </div>

      {showSearch && (
        <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4 bg-blue-50 dark:bg-blue-900/20">
          <input autoFocus
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 mb-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
            placeholder={`${t('common.search')} ${t('exercises.title').toLowerCase()}...`}
            value={search} onChange={e => doSearch(e.target.value)} />
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {results.map(ex => (
              <button key={ex.id} type="button" onClick={() => addExercise(ex)}
                className="w-full text-left px-3 py-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg text-sm flex items-center justify-between">
                <span className="font-medium text-gray-800 dark:text-gray-200">{ex.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{ex.category}</span>
              </button>
            ))}
            {search.trim() && results.length === 0 && (
              <button type="button" onClick={createAndAdd} disabled={creating}
                className="w-full text-left px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-white dark:hover:bg-gray-800 rounded-lg text-sm font-medium disabled:opacity-50">
                {creating ? t('common.loading') : `+ ${t('common.add')} "${search}"`}
              </button>
            )}
            {!search && results.length === 0 && (
              <p className="text-gray-400 dark:text-gray-500 text-xs px-3 py-1">
                {t('common.search')} {t('exercises.title').toLowerCase()}...
              </p>
            )}
          </div>
          <button type="button" onClick={() => setShowSearch(false)}
            className="text-gray-400 dark:text-gray-500 text-xs mt-2 hover:text-gray-600 dark:hover:text-gray-300">
            {t('common.close')}
          </button>
        </div>
      )}

      {exercises.length === 0 && !showSearch && (
        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          {t('form.noExercisesYet')}
        </p>
      )}

      {exercises.map((ex, idx) => (
        <div key={idx} className="relative">
          {exercises.length > 1 && (
            <div className="absolute -left-6 top-3 flex flex-col gap-0.5 z-10">
              <button type="button" onClick={() => moveExercise(idx, -1)} disabled={idx === 0}
                className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▲</button>
              <button type="button" onClick={() => moveExercise(idx, 1)} disabled={idx === exercises.length - 1}
                className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▼</button>
            </div>
          )}
          <ExerciseCard ex={ex} exIdx={idx} fields={fields}
            onChange={updated => updateExercise(idx, updated)}
            onRemove={() => removeExercise(idx)} />
        </div>
      ))}
    </div>
  );
}
