// frontend/src/components/AssignPackageModal.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TYPE_LABELS = {
  session_based: '🎯 Session-based',
  time_based: '📅 Time-based',
  unlimited: '♾️ Unlimited',
};

const AssignPackageModal = ({ clientName, onClose, onAssigned }) => {
  const { t } = useTranslation();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/packages`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setPackages((d.packages || []).filter(p => p.is_active));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAssign = async () => {
    if (!selected) { setError('Please select a package.'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/clients/${onAssigned.clientId}/packages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selected, startDate, notes })
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Failed to assign package.'); return; }
      onAssigned.onSuccess(data.package);
    } catch {
      setError('Failed to assign package.');
    } finally {
      setSaving(false);
    }
  };

  const selectedPkg = packages.find(p => p.id === selected);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-900">Assign Package</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-5">to {clientName}</p>

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-8">Loading packages...</p>
        ) : packages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-600 font-medium mb-1">No packages created yet</p>
            <p className="text-sm text-gray-400 mb-5">Create packages first before assigning them to clients.</p>
            <button
              onClick={() => { onClose(); navigate('/dashboard/packages'); }}
              className="btn-primary text-sm"
            >
              Go to Packages →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Package *</label>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {packages.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelected(p.id); setError(''); }}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                      selected === p.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        {p.price && (
                          <span className="text-sm font-bold text-gray-700">
                            {Number(p.price).toFixed(2)} {p.currency}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {TYPE_LABELS[p.package_type]}
                        {p.total_sessions ? ` · ${p.total_sessions} sessions` : ''}
                        {p.duration_days ? ` · ${p.duration_days} days` : ''}
                        {p.sessions_per_period && p.period_days ? ` · ${p.sessions_per_period} per ${p.period_days} days` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
            </div>

            {selectedPkg?.duration_days && (
              <div className="bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-700">
                  📅 Package expires: <strong>
                    {new Date(new Date(startDate).getTime() + selectedPkg.duration_days * 86400000)
                      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </strong> ({selectedPkg.duration_days} days)
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="e.g. Paid by bank transfer" />
            </div>

            {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 btn-secondary">{t('common.cancel')}</button>
              <button type="button" onClick={handleAssign} disabled={saving || !selected} className="flex-1 btn-primary disabled:opacity-50">
                {saving ? 'Assigning...' : 'Assign Package'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignPackageModal;
