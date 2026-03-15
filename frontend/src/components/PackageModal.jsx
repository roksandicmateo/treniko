// frontend/src/components/PackageModal.jsx  (NEW FILE)
import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const PACKAGE_TYPES = [
  {
    value: 'session_based',
    label: 'Session-based',
    icon: '🎯',
    desc: 'A fixed number of sessions (e.g. "10 Training Sessions")'
  },
  {
    value: 'time_based',
    label: 'Time-based',
    icon: '📅',
    desc: 'Valid for a set number of days (e.g. "30-Day Pass")'
  },
  {
    value: 'unlimited',
    label: 'Unlimited',
    icon: '♾️',
    desc: 'Unlimited sessions within a time period (e.g. "Monthly Unlimited")'
  },
];

const empty = {
  name: '', description: '', price: '', currency: 'EUR',
  packageType: 'session_based',
  totalSessions: '', durationDays: '',
  sessionsPerPeriod: '', periodDays: '',
};

const PackageModal = ({ pkg, onClose, onSaved }) => {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (pkg) {
      setForm({
        name: pkg.name || '',
        description: pkg.description || '',
        price: pkg.price || '',
        currency: pkg.currency || 'EUR',
        packageType: pkg.package_type || 'session_based',
        totalSessions: pkg.total_sessions || '',
        durationDays: pkg.duration_days || '',
        sessionsPerPeriod: pkg.sessions_per_period || '',
        periodDays: pkg.period_days || '',
      });
    }
  }, [pkg]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Package name is required.'); return; }
    if (form.packageType === 'session_based' && !form.totalSessions) {
      setError('Total sessions is required for session-based packages.'); return;
    }
    if (form.packageType !== 'session_based' && !form.durationDays) {
      setError('Duration (days) is required for time-based and unlimited packages.'); return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const url = pkg
        ? `${API_URL}/packages/${pkg.id}`
        : `${API_URL}/packages`;
      const method = pkg ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Failed to save.'); return; }
      onSaved(data.package);
    } catch {
      setError('Failed to save package.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-5">
          {pkg ? 'Edit Package' : 'Create Package'}
        </h2>

        <div className="space-y-4">

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="input"
              placeholder='e.g. "10 Training Sessions"'
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="input resize-none"
              rows={2}
              placeholder="Optional description visible to you"
            />
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => set('price', e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={e => set('currency', e.target.value)}
                className="input"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="HRK">HRK</option>
              </select>
            </div>
          </div>

          {/* Package type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Package Type *</label>
            <div className="space-y-2">
              {PACKAGE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set('packageType', t.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                    form.packageType === t.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl mt-0.5">{t.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.label}</p>
                    <p className="text-xs text-gray-500">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Session-based rules */}
          {form.packageType === 'session_based' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Sessions *</label>
              <input
                type="number"
                min="1"
                value={form.totalSessions}
                onChange={e => set('totalSessions', e.target.value)}
                className="input"
                placeholder="e.g. 10"
              />
            </div>
          )}

          {/* Time-based / unlimited rules */}
          {(form.packageType === 'time_based' || form.packageType === 'unlimited') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days) *</label>
              <input
                type="number"
                min="1"
                value={form.durationDays}
                onChange={e => set('durationDays', e.target.value)}
                className="input"
                placeholder="e.g. 30"
              />
            </div>
          )}

          {/* Sessions per period (optional for all types) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sessions per period <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="1"
                value={form.sessionsPerPeriod}
                onChange={e => set('sessionsPerPeriod', e.target.value)}
                className="input"
                placeholder="e.g. 8 sessions"
              />
              <input
                type="number"
                min="1"
                value={form.periodDays}
                onChange={e => set('periodDays', e.target.value)}
                className="input"
                placeholder="per X days"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">e.g. 8 sessions per 30 days</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving...' : pkg ? 'Save Changes' : 'Create Package'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageModal;
