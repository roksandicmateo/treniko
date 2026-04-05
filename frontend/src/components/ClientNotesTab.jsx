// frontend/src/components/ClientNotesTab.jsx  (NEW FILE)
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const NOTE_FIELDS = [
  { key: 'goals',     labelKey: 'notes.goals',     icon: '🎯', placeholderKey: 'notes.goalsPlaceholder' },
  { key: 'injuries',  labelKey: 'notes.injuries',   icon: '🩹', placeholderKey: 'notes.injuriesPlaceholder' },
  { key: 'dietNotes', labelKey: 'notes.diet',        icon: '🥗', placeholderKey: 'notes.dietPlaceholder' },
  { key: 'notes',     labelKey: 'notes.general',     icon: '📝', placeholderKey: 'notes.generalPlaceholder' },
];

const ClientNotesTab = ({ client, onUpdated }) => {
  const { t } = useTranslation();
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
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('notes.clientNotes')}</h3>
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {hasAnyContent ? t('common.edit') : `+ ${t('notes.addNotes')}`}
          </button>
        </div>

        {!hasAnyContent ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm text-gray-400 mb-3">{t('notes.noNotes')}</p>
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-blue-600 hover:underline"
            >
{t('notes.addGoals')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Date of birth */}
            {client.date_of_birth && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">🎂 {t('clients.dateOfBirth')}</p>
                <p className="text-sm text-gray-800">
                  {new Date(client.date_of_birth).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                  {' '}
                  <span className="text-gray-400 text-xs">
                    ({t('notes.age')}: {Math.floor((new Date() - new Date(client.date_of_birth)) / 31557600000)})
                  </span>
                </p>
              </div>
            )}

            {NOTE_FIELDS.map(({ key, label, icon }) => {
              const value = key === 'dietNotes' ? client.diet_notes : client[key];
              if (!value) return null;
              return (
                <div key={key} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{icon} {t(labelKey)}</p>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">🎂 {t('clients.dateOfBirth')}</label>
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
          className="input"
        />
      </div>

      {NOTE_FIELDS.map(({ key, labelKey, icon, placeholderKey }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{icon} {t(labelKey)}</label>
          <textarea
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            placeholder={t(placeholderKey)}
            rows={3}
            className="input resize-none"
          />
        </div>
      ))}

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={handleCancel} className="flex-1 btn-secondary" disabled={saving}>{t('common.cancel')}</button>
        <button onClick={handleSave} className="flex-1 btn-primary disabled:opacity-50" disabled={saving}>
          {saving ? t('common.saving') : t('notes.saveNotes')}
        </button>
      </div>
    </div>
  );
};

export default ClientNotesTab;
