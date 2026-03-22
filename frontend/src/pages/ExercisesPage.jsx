// frontend/src/pages/ExercisesPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { showToast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const CATEGORIES = ['Strength', 'Cardio', 'Mobility', 'Bodyweight', 'Olympic', 'Other'];
const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Core', 'Glutes', 'Quads', 'Hamstrings', 'Calves', 'Full Body'];
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Bodyweight', 'Bands', 'Other'];
const UNITS = ['kg', 'lb', 'reps', 'sec', 'min', 'km', 'mi'];

const CATEGORY_COLORS = {
  Strength:   'bg-blue-100 text-blue-700',
  Cardio:     'bg-green-100 text-green-700',
  Mobility:   'bg-purple-100 text-purple-700',
  Bodyweight: 'bg-orange-100 text-orange-700',
  Olympic:    'bg-red-100 text-red-700',
  Other:      'bg-gray-100 text-gray-600',
};

const token = () => localStorage.getItem('token');

// ── Exercise Modal ────────────────────────────────────────────────────────────
const ExerciseModal = ({ exercise, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name:        exercise?.name         || '',
    category:    exercise?.category     || 'Strength',
    muscleGroup: exercise?.muscle_group || '',
    equipment:   exercise?.equipment    || '',
    defaultUnit: exercise?.default_unit || 'kg',
    description: exercise?.description  || '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const url    = exercise ? `${API_URL}/exercises/${exercise.id}` : `${API_URL}/exercises`;
      const method = exercise ? 'PUT' : 'POST';
      const res  = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      onSaved(data);
    } catch { setError('Failed to save exercise'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">{exercise ? 'Edit Exercise' : 'New Exercise'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input" placeholder="e.g. Bench Press" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Unit</label>
              <select value={form.defaultUnit} onChange={e => setForm(f => ({ ...f, defaultUnit: e.target.value }))} className="input">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Muscle Group</label>
              <select value={form.muscleGroup} onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value }))} className="input">
                <option value="">— optional —</option>
                {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
              <select value={form.equipment} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))} className="input">
                <option value="">— optional —</option>
                {EQUIPMENT.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="input" placeholder="Instructions, cues, notes..." />
          </div>

          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary disabled:opacity-50">
              {saving ? 'Saving...' : exercise ? 'Save Changes' : 'Create Exercise'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExercisesPage() {
  const [exercises,   setExercises]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState('');
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/exercises`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setExercises(Array.isArray(data) ? data : []);
    } catch { showToast('Failed to load exercises', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved) => {
    setExercises(prev => {
      const idx = prev.findIndex(e => e.id === saved.id);
      return idx >= 0 ? prev.map((e, i) => i === idx ? saved : e) : [...prev, saved];
    });
    setModalOpen(false);
    setEditing(null);
    showToast(editing ? 'Exercise updated' : 'Exercise created', 'success');
  };

  const handleDelete = async (ex) => {
    try {
      const res = await fetch(`${API_URL}/exercises/${ex.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Failed to delete', 'error'); return; }
      setExercises(prev => prev.filter(e => e.id !== ex.id));
      showToast('Exercise deleted', 'success');
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleteConfirm(null); }
  };

  // Filter
  const filtered = exercises.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.muscle_group || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || e.category === filterCat;
    return matchSearch && matchCat;
  });

  // Group by category
  const grouped = filtered.reduce((acc, ex) => {
    const cat = ex.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ex);
    return acc;
  }, {});

  const counts = exercises.reduce((acc, ex) => {
    const cat = ex.category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exercise Library</h1>
          <p className="text-sm text-gray-500 mt-1">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''} in your library</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
          + Add Exercise
        </button>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setFilterCat('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!filterCat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          All ({exercises.length})
        </button>
        {CATEGORIES.filter(c => counts[c]).map(cat => (
          <button key={cat} onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCat === cat ? 'bg-gray-900 text-white' : `${CATEGORY_COLORS[cat]} hover:opacity-80`}`}>
            {cat} ({counts[cat] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises or muscle groups..."
          className="input pl-9" />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading exercises...</div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">🏋️</p>
          <p className="text-gray-600 font-medium mb-1">No exercises yet</p>
          <p className="text-sm text-gray-400 mb-5">Build your exercise library to use when logging trainings.</p>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">Add Your First Exercise</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm">No exercises match your search</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, exs]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600'}`}>{cat}</span>
                <span className="text-xs text-gray-400">{exs.length} exercise{exs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid gap-2">
                {exs.map(ex => (
                  <div key={ex.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{ex.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {ex.muscle_group && (
                          <span className="text-xs text-gray-500">💪 {ex.muscle_group}</span>
                        )}
                        {ex.equipment && (
                          <span className="text-xs text-gray-500">🔧 {ex.equipment}</span>
                        )}
                        <span className="text-xs text-gray-400">📏 {ex.default_unit}</span>
                      </div>
                      {ex.description && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{ex.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setEditing(ex); setModalOpen(true); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50">
                        Edit
                      </button>
                      <button onClick={() => setDeleteConfirm(ex)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Exercise modal */}
      {modalOpen && (
        <ExerciseModal
          exercise={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Exercise?</h3>
            <p className="text-sm text-gray-500 mb-1">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-5">
              ⚠️ Cannot delete if this exercise is used in existing trainings.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
