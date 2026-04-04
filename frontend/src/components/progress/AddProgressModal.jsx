import { useState } from 'react';
import { progressService } from '../../services/trainingService';
import { useTranslation } from 'react-i18next';

const COMMON_METRICS = [
  { name: 'Weight',      unit: 'kg' },
  { name: 'Body Fat %',  unit: '%'  },
  { name: 'Chest',       unit: 'cm' },
  { name: 'Waist',       unit: 'cm' },
  { name: 'Hips',        unit: 'cm' },
  { name: 'Bicep',       unit: 'cm' },
  { name: 'Thigh',       unit: 'cm' },
  { name: 'BMI',         unit: ''   },
];

export default function AddProgressModal({
  clientId, onClose, onSaved }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    metricName: 'Weight',
    unit:       'kg',
    value:      '',
    date:       today,
    notes:      '',
  });

  function selectMetric(metric) {
    setForm((f) => ({ ...f, metricName: metric.name, unit: metric.unit }));
  }

  async function handleSave() {
    if (!form.value) return setError('Value is required');
    if (!form.date)  return setError('Date is required');
    setSaving(true); setError('');
    try {
      const { data } = await progressService.addEntry(clientId, form);
      onSaved(data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Add Progress Entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Metric selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Metric</label>
            <button
              onClick={() => setCustom((c) => !c)}
              className="text-blue-600 text-xs hover:underline"
            >
              {custom ? 'Use common' : 'Custom metric'}
            </button>
          </div>

          {custom ? (
            <div className="grid grid-cols-2 gap-2">
              <input
                className="border border-gray-300 rounded-xl p-2.5 text-sm"
                placeholder="Metric name"
                value={form.metricName}
                onChange={(e) => setForm((f) => ({ ...f, metricName: e.target.value }))}
              />
              <input
                className="border border-gray-300 rounded-xl p-2.5 text-sm"
                placeholder="Unit (kg, cm…)"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {COMMON_METRICS.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => selectMetric(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    form.metricName === m.name
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Value + Unit */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Value <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border border-gray-300 rounded-xl p-3 text-sm"
              placeholder="0.0"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
            <input
              className="w-full border border-gray-300 rounded-xl p-3 text-sm"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-xl p-3 text-sm"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>

        {/* Notes */}
        <input
          className="w-full border border-gray-300 rounded-xl p-3 text-sm"
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 py-3 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold"
          >
            {saving ? t('common.saving') : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
