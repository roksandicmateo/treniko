// frontend/src/components/PackageModal.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const empty = {
  name: '', description: '', price: '', currency: 'EUR',
  packageType: 'session_based',
  totalSessions: '', durationDays: '',
  sessionsPerPeriod: '', periodDays: '',
};

const PackageModal = ({ pkg, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const PACKAGE_TYPES = [
    { value: 'session_based', label: t('packages.sessionBased'), icon: '🎯', desc: 'A fixed number of sessions (e.g. "10 Training Sessions")' },
    { value: 'time_based',    label: t('packages.timeBased'),    icon: '📅', desc: 'Valid for a set number of days (e.g. "30-Day Pass")' },
    { value: 'unlimited',     label: t('packages.unlimited'),    icon: '♾️', desc: 'Unlimited sessions within a time period (e.g. "Monthly Unlimited")' },
  ];

  useEffect(() => {
    if (pkg) {
      setForm({
        name: pkg.name || '', description: pkg.description || '',
        price: pkg.price || '', currency: pkg.currency || 'EUR',
        packageType: pkg.package_type || 'session_based',
        totalSessions: pkg.total_sessions || '', durationDays: pkg.duration_days || '',
        sessionsPerPeriod: pkg.sessions_per_period || '', periodDays: pkg.period_days || '',
      });
    }
  }, [pkg]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Package name is required.'); return; }
    if (form.packageType === 'session_based' && !form.totalSessions) { setError('Total sessions is required.'); return; }
    if (form.packageType !== 'session_based' && !form.durationDays) { setError('Duration (days) is required.'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const url    = pkg ? `${API_URL}/packages/${pkg.id}` : `${API_URL}/packages`;
      const method = pkg ? 'PUT' : 'POST';
      const res  = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Failed to save.'); return; }
      onSaved(data.package);
    } catch { setError('Failed to save package.'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">
          {pkg ? `${t('common.edit')} ${t('packages.title').slice(0, -1)}` : t('packages.newPackage').replace('+ ', '')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className={lbl}>{t('form.packageName')} *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder='e.g. "10 Training Sessions"' />
          </div>
          <div>
            <label className={lbl}>{t('exercises.description')}</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input resize-none" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{t('form.price')}</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} className="input" placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>{t('form.currency')}</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
                <option value="EUR">EUR</option><option value="USD">USD</option>
                <option value="GBP">GBP</option><option value="HRK">HRK</option>
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>{t('form.packageType')} *</label>
            <div className="space-y-2">
              {PACKAGE_TYPES.map(type => (
                <button key={type.value} type="button" onClick={() => set('packageType', type.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                    form.packageType === type.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}>
                  <span className="text-xl mt-0.5">{type.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{type.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          {form.packageType === 'session_based' && (
            <div>
              <label className={lbl}>{t('form.totalSessions')} *</label>
              <input type="number" min="1" value={form.totalSessions} onChange={e => set('totalSessions', e.target.value)} className="input" placeholder="e.g. 10" />
            </div>
          )}
          {(form.packageType === 'time_based' || form.packageType === 'unlimited') && (
            <div>
              <label className={lbl}>{t('form.duration')} *</label>
              <input type="number" min="1" value={form.durationDays} onChange={e => set('durationDays', e.target.value)} className="input" placeholder="e.g. 30" />
            </div>
          )}
          <div>
            <label className={lbl}>{t('form.sessionsPerPeriod')} <span className="text-gray-400 font-normal">({t('common.optional')})</span></label>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="1" value={form.sessionsPerPeriod} onChange={e => set('sessionsPerPeriod', e.target.value)} className="input" placeholder="e.g. 8" />
              <input type="number" min="1" value={form.periodDays} onChange={e => set('periodDays', e.target.value)} className="input" placeholder="per X days" />
            </div>
          </div>
          {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">{t('common.cancel')}</button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex-1 btn-primary disabled:opacity-50">
              {saving ? t('common.saving') : pkg ? t('profile.saveChanges') : t('packages.newPackage').replace('+ ', '')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageModal;
