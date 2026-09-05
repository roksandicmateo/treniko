// frontend/src/components/ClientNotesTab.jsx  (NEW FILE)
import Icon from './Icon';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '../utils/locale';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const NOTE_FIELDS = [
  { key: 'goals',     labelKey: 'notes.goals',     icon: 'trophy', placeholderKey: 'notes.goalsPlaceholder' },
  { key: 'injuries',  labelKey: 'notes.injuries',   icon: 'alert', placeholderKey: 'notes.injuriesPlaceholder' },
  { key: 'dietNotes', labelKey: 'notes.diet',        icon: 'note', placeholderKey: 'notes.dietPlaceholder' },
  { key: 'notes',     labelKey: 'notes.general',     icon: 'note', placeholderKey: 'notes.generalPlaceholder' },
];

const ClientNotesTab = ({ client, onUpdated }) => {
  const { t } = useTranslation();
  // Was `undefined`, i.e. the machine's locale, not the app's language —
  // see src/utils/locale.js.
  const dateLocale = useDateLocale();
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
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">{t('notes.clientNotes')}</h3>
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400"
          >
            {hasAnyContent ? t('common.edit') : `+ ${t('notes.addNotes')}`}
          </button>
        </div>

        {!hasAnyContent ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center dark:border-gray-700">
            <p className="mb-2"><Icon name="note" className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600" /></p>
            <p className="text-sm text-gray-400 mb-3 dark:text-gray-500">{t('notes.noNotes')}</p>
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
{t('notes.addGoals')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Date of birth */}
            {client.date_of_birth && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 dark:bg-gray-800">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 dark:text-gray-500">{t('clients.dateOfBirth')}</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {new Date(client.date_of_birth).toLocaleDateString(dateLocale, {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                  {' '}
                  <span className="text-gray-400 text-xs dark:text-gray-500">
                    ({t('notes.age')}: {Math.floor((new Date() - new Date(client.date_of_birth)) / 31557600000)})
                  </span>
                </p>
              </div>
            )}

            {NOTE_FIELDS.map(({ key, labelKey, icon }) => {
              const value = key === 'dietNotes' ? client.diet_notes : client[key];
              if (!value) return null;
              return (
                <div key={key} className="bg-gray-50 rounded-xl px-4 py-3 dark:bg-gray-800">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 dark:text-gray-500 flex items-center gap-1.5">
                    <Icon name={icon} className="h-3.5 w-3.5" />{t(labelKey)}
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap dark:text-gray-200">{value}</p>
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
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">{t('notes.editNotes')}</h3>
      </div>

      {/* Date of birth */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">{t('clients.dateOfBirth')}</label>
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
          className="input"
        />
      </div>

      {NOTE_FIELDS.map(({ key, labelKey, icon, placeholderKey }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">{icon} {t(labelKey)}</label>
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
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm dark:bg-red-950/40 dark:text-red-400">{error}</div>
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
