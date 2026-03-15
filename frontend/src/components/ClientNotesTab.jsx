// frontend/src/components/ClientNotesTab.jsx  (NEW FILE)
import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const NOTE_FIELDS = [
  { key: 'goals',     label: 'Goals',          icon: '🎯', placeholder: 'e.g. Lose 10kg, run a 5K, build muscle...' },
  { key: 'injuries',  label: 'Injuries & Health', icon: '🩹', placeholder: 'e.g. Lower back pain, knee injury 2023...' },
  { key: 'dietNotes', label: 'Diet & Nutrition', icon: '🥗', placeholder: 'e.g. Vegetarian, lactose intolerant, high protein...' },
  { key: 'notes',     label: 'General Notes',   icon: '📝', placeholder: 'Any other notes about this client...' },
];

const ClientNotesTab = ({ client, onUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    dateOfBirth: client.date_of_birth ? client.date_of_birth.split('T')[0] : '',
    goals:       client.goals       || '',
    injuries:    client.injuries    || '',
    dietNotes:   client.diet_notes  || '',
    notes:       client.notes       || '',
  });
  const [error, setError] = useState('');

  const hasAnyContent = client.goals || client.injuries || client.diet_notes || client.notes || client.date_of_birth;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/clients/${client.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) { setError(data.message || 'Failed to save.'); return; }
      setEditing(false);
      onUpdated(data.client);
    } catch {
      setError('Failed to save notes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      dateOfBirth: client.date_of_birth ? client.date_of_birth.split('T')[0] : '',
      goals:       client.goals       || '',
      injuries:    client.injuries    || '',
      dietNotes:   client.diet_notes  || '',
      notes:       client.notes       || '',
    });
    setEditing(false);
    setError('');
  };

  // ── View mode ──
  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Client Notes</h3>
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {hasAnyContent ? 'Edit' : '+ Add Notes'}
          </button>
        </div>

        {!hasAnyContent ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm text-gray-400 mb-3">No notes added yet</p>
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              Add goals, injuries, diet notes...
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Date of birth */}
            {client.date_of_birth && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">🎂 Date of Birth</p>
                <p className="text-sm text-gray-800">
                  {new Date(client.date_of_birth).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                  {' '}
                  <span className="text-gray-400 text-xs">
                    (Age: {Math.floor((new Date() - new Date(client.date_of_birth)) / 31557600000)})
                  </span>
                </p>
              </div>
            )}

            {NOTE_FIELDS.map(({ key, label, icon }) => {
              const value = key === 'dietNotes' ? client.diet_notes : client[key];
              if (!value) return null;
              return (
                <div key={key} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{icon} {label}</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Edit mode ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Edit Notes</h3>
      </div>

      {/* Date of birth */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">🎂 Date of Birth</label>
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
          className="input"
        />
      </div>

      {NOTE_FIELDS.map(({ key, label, icon, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{icon} {label}</label>
          <textarea
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            rows={3}
            className="input resize-none"
          />
        </div>
      ))}

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={handleCancel} className="flex-1 btn-secondary" disabled={saving}>Cancel</button>
        <button onClick={handleSave} className="flex-1 btn-primary disabled:opacity-50" disabled={saving}>
          {saving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
    </div>
  );
};

export default ClientNotesTab;
